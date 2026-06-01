import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

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

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
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

      await supabaseAdmin
        .from("profiles")
        .update({
          plan_type: plan,
          subscription_status: "active",
          stripe_customer_id: session.customer as string,
          stripe_sub_id: session.subscription as string,
          plan_expires_at: sub
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        })
        .eq("id", userId);
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

      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: status,
          plan_expires_at: new Date(sub.current_period_end * 1000).toISOString(),
        })
        .eq("stripe_sub_id", sub.id);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("profiles")
        .update({
          plan_type: "free",
          subscription_status: "active",
          stripe_sub_id: null,
          plan_expires_at: null,
        })
        .eq("stripe_sub_id", sub.id);
      break;
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
