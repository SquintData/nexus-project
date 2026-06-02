import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://usenexus.online";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // --- Auth: trust ONLY the verified JWT, never the request body ---
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  // RLS-scoped client (anon key + caller JWT): can only ever read the caller's
  // own profile row, so the customer_id is derived from the authenticated
  // identity — never from client-supplied input.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  try {
    const { data: profile, error: dbError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    // Graceful DB failure: log internally, return a clean generic message.
    if (dbError) {
      console.error("[stripe-portal] profile lookup failed:", dbError.message);
      return new Response(
        JSON.stringify({ error: "Unable to load billing profile" }),
        { status: 500, headers: JSON_HEADERS },
      );
    }

    const customerId = profile?.stripe_customer_id;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "No active subscription" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE_URL}/app`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: JSON_HEADERS,
    });
  } catch (e: unknown) {
    // Never leak stack traces / Stripe internals to the client.
    console.error(
      "[stripe-portal] portal session creation failed:",
      e instanceof Error ? e.message : e,
    );
    return new Response(
      JSON.stringify({ error: "Unable to open billing portal" }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
