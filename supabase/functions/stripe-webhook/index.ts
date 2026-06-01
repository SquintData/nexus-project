import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
// Deno edge runtime: signature verification must go through the async SubtleCrypto
// path. The synchronous constructEvent() throws "SubtleCryptoProvider cannot be
// used in a synchronous context", which is why every event was 400ing.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function planFromPriceId(priceId: string): "chat" | "voice" {
  const chatIds = [
    Deno.env.get("STRIPE_PRICE_CHAT_MONTHLY"),
    Deno.env.get("STRIPE_PRICE_CHAT_YEARLY"),
  ];
  return chatIds.includes(priceId) ? "chat" : "voice";
}

// Stripe moved `current_period_end` from the subscription to its items in the
// 2025 API ("Basil"). Read items-first with a fallback, and never throw on a
// missing/NaN value — return null so the caller skips the field instead of
// writing `new Date(NaN).toISOString()` (which throws → webhook 500 → retry loop).
function periodEndISO(sub: Stripe.Subscription | null): string | null {
  if (!sub) return null;
  const epoch =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof epoch === "number" && Number.isFinite(epoch)
    ? new Date(epoch * 1000).toISOString()
    : null;
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", (err as Error)?.message);
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id ?? session.client_reference_id;
      if (!userId) break;

      const sub = session.subscription
        ? await stripe.subscriptions.retrieve(session.subscription as string)
        : null;

      const priceId = sub?.items.data[0]?.price.id ?? "";
      const plan = planFromPriceId(priceId);

      const update: Record<string, unknown> = {
        plan_type: plan,
        subscription_status: "active",
        stripe_customer_id: session.customer as string,
        stripe_sub_id: session.subscription as string,
      };
      // Only set expiry when resolved — never clobber a good value with null
      // because of a parsing miss.
      const expISO = periodEndISO(sub);
      if (expISO) update.plan_expires_at = expISO;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update(update)
        .eq("id", userId);
      // Surface DB failures so Stripe retries instead of silently dropping the upgrade.
      if (error) return new Response("DB update failed", { status: 500 });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const status =
        sub.status === "active"
          ? "active"
          : sub.status === "past_due"
          ? "past_due"
          : "canceled";

      const update: Record<string, unknown> = { subscription_status: status };
      const expISO = periodEndISO(sub);
      if (expISO) update.plan_expires_at = expISO;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update(update)
        .eq("stripe_sub_id", sub.id);
      if (error) return new Response("DB update failed", { status: 500 });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Downgrade to free. free is "active" (no paid window) → expiry cleared.
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          plan_type: "free",
          subscription_status: "active",
          stripe_sub_id: null,
          plan_expires_at: null,
        })
        .eq("stripe_sub_id", sub.id);
      if (error) return new Response("DB update failed", { status: 500 });
      break;
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
