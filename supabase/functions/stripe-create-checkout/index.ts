import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const PRICE_IDS: Record<string, Record<string, string>> = {
  chat: {
    monthly: Deno.env.get("STRIPE_PRICE_CHAT_MONTHLY")!,
    yearly: Deno.env.get("STRIPE_PRICE_CHAT_YEARLY")!,
  },
  voice: {
    monthly: Deno.env.get("STRIPE_PRICE_VOICE_MONTHLY")!,
    yearly: Deno.env.get("STRIPE_PRICE_VOICE_YEARLY")!,
  },
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://usenexus.online";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { plan, billing } = await req.json() as { plan: string; billing: string };
    const priceId = PRICE_IDS[plan]?.[billing];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Invalid plan/billing" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id: user.id },
      success_url: `${SITE_URL}/app?upgraded=1`,
      cancel_url: `${SITE_URL}/upgrade?plan=${plan}`,
      client_reference_id: user.id,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
