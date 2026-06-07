import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.25.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Strict CORS allowlist (no wildcard). Override via ALLOWED_ORIGINS env
// (comma-separated) for extra environments; defaults cover prod + Vite dev.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "https://usenexus.online,http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    // supabase-js functions.invoke() always sends x-client-info (+ apikey) on
    // top of authorization/content-type. Omitting x-client-info makes the CORS
    // preflight fail, so the browser silently blocks the POST (only OPTIONS
    // 200s show in logs). Keep this list in sync with what invoke sends.
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  // Echo the origin ONLY if explicitly allowed; otherwise omit
  // Access-Control-Allow-Origin so the browser blocks the cross-origin read.
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

// Stripe moved current_period_end onto subscription items in the 2025 API.
// Items-first with fallback; null if unresolved (UI shows "—").
function periodEndISO(sub: Stripe.Subscription): string | null {
  const epoch =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof epoch === "number" && Number.isFinite(epoch)
    ? new Date(epoch * 1000).toISOString()
    : null;
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // verify_jwt:true → the gateway already validated the bearer token. Build an
  // RLS-scoped client from that SAME token so the profiles read is auto-
  // restricted to the caller's own row (RLS: auth.uid() = id). The customer_id
  // therefore comes from the DB keyed by the JWT-derived uid — never from a
  // token claim (we have no custom claims).
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  let profile:
    | { plan_type: string; stripe_customer_id: string | null; stripe_sub_id: string | null }
    | null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("plan_type, stripe_customer_id, stripe_sub_id")
      .maybeSingle(); // RLS → only the caller's row
    if (error) throw error;
    profile = data;
  } catch (e) {
    console.error("[stripe-subscription] profile lookup failed:", (e as Error)?.message);
    return json({ error: "Unable to load account" }, 500);
  }

  // Free / no Stripe customer or subscription yet → nothing to fetch.
  if (!profile?.stripe_customer_id || !profile?.stripe_sub_id) {
    return json({ subscribed: false, plan_type: profile?.plan_type ?? "free" });
  }

  try {
    // Parallel: subscription detail + invoice history (no sequential latency).
    const [sub, invoiceList] = await Promise.all([
      stripe.subscriptions.retrieve(profile.stripe_sub_id, {
        expand: ["default_payment_method", "items.data.price"],
      }),
      stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 10 }),
    ]);

    const price = sub.items.data[0]?.price;
    const pm = sub.default_payment_method;
    const card =
      pm && typeof pm !== "string" && pm.card
        ? { brand: pm.card.brand, last4: pm.card.last4 } // brand + last4 ONLY
        : null;

    // Edge cases: data may be undefined/empty on brand-new accounts, and a bad
    // epoch must not throw — fall back to null per invoice.
    const rawInvoices = Array.isArray(invoiceList?.data) ? invoiceList.data : [];
    const invoices = rawInvoices.map((inv) => {
      let date: string | null = null;
      try {
        if (typeof inv.created === "number" && Number.isFinite(inv.created)) {
          date = new Date(inv.created * 1000).toISOString();
        }
      } catch {
        date = null;
      }
      return {
        date,
        amount: (inv.total ?? 0) / 100,
        currency: inv.currency ?? null,
        status: inv.status ?? null,
        url: inv.hosted_invoice_url ?? inv.invoice_pdf ?? null,
      };
    });

    return json({
      subscribed: true,
      plan_type: profile.plan_type,
      status: sub.status,
      current_period_end: periodEndISO(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
      amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
      currency: price?.currency ?? null,
      interval: price?.recurring?.interval ?? null,
      card,
      invoices,
    });
  } catch (e) {
    // Never leak Stripe internals — log server-side, return a clean message.
    console.error("[stripe-subscription] stripe fetch failed:", (e as Error)?.message);
    return json({ error: "Unable to load subscription" }, 502);
  }
});
