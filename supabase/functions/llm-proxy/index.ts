import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const DAILY_CAP = 500;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const RANK: Record<string, number> = { free: 0, chat: 1, voice: 2 };
const GRACE_MS = Number(Deno.env.get("PLAN_EXPIRY_GRACE_HOURS") ?? "48") * 3600_000;

// Server-side plan enforcement. Uses the service-role `admin` client so RLS does
// NOT block reading `profiles`. NULL plan_expires_at = no expiry (allowed). A
// set expiry only denies once it is past now + the grace window (absorbs a late
// Stripe renewal webhook). Mirrors the frontend hasAccess/RANK.
async function guardPlan(userId: string, required: "chat" | "voice"): Promise<Response | null> {
  const { data: p } = await admin
    .from("profiles")
    .select("plan_type, subscription_status, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const deny = (code: string, message: string) =>
    new Response(JSON.stringify({ error: { code, required, message } }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  if (!p) return deny("no_profile", "perfil não encontrado");
  if ((RANK[p.plan_type] ?? 0) < RANK[required]) return deny("plan_required", `requer plano ${required}`);
  if (p.subscription_status !== "active") return deny("subscription_inactive", "assinatura inativa");
  if (p.plan_expires_at) {
    const exp = new Date(p.plan_expires_at).getTime();
    if (Number.isFinite(exp) && exp + GRACE_MS < Date.now()) return deny("plan_expired", "plano expirado");
  }
  return null;
}

async function authUser(req: Request): Promise<{ id: string } | Response> {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return new Response(JSON.stringify({ error: { message: "missing bearer token" } }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return new Response(JSON.stringify({ error: { message: "invalid token" } }), { status: 401, headers: { "Content-Type": "application/json" } });
  return { id: data.user.id };
}

async function checkQuota(userId: string): Promise<Response | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("llm_usage").select("calls").eq("user_id", userId).eq("usage_date", today).eq("kind", "chat").maybeSingle();
  if ((data?.calls ?? 0) >= DAILY_CAP) {
    return new Response(JSON.stringify({ error: { message: `daily quota exceeded (${DAILY_CAP} chat calls)` } }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  return null;
}

async function recordUsage(userId: string, input: number, output: number) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin.rpc("increment_llm_usage", { p_user_id: userId, p_date: today, p_kind: "chat", p_input: input, p_output: output });
  if (error) console.error("recordUsage failed", error);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" } });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const user = await authUser(req);
  if (user instanceof Response) return user;

  const denied = await guardPlan(user.id, "chat");
  if (denied) return denied;

  const quota = await checkQuota(user.id);
  if (quota) return quota;

  const body = await req.text();
  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body,
  });
  const respText = await upstream.text();

  if (upstream.ok) {
    try {
      const j = JSON.parse(respText);
      recordUsage(user.id, j.usage?.prompt_tokens ?? 0, j.usage?.completion_tokens ?? 0).catch(console.error);
    } catch (_e) { /* non-JSON response, skip */ }
  }

  return new Response(respText, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" } });
});
