import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const EMBEDDING_MODEL = "text-embedding-3-small";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const RANK: Record<string, number> = { free: 0, chat: 1, voice: 2 };
const GRACE_MS = Number(Deno.env.get("PLAN_EXPIRY_GRACE_HOURS") ?? "48") * 3600_000;

// Server-side plan enforcement (mirrors llm/stt/tts proxies).
async function guardPlan(userId: string, required: "chat" | "voice"): Promise<Response | null> {
  const { data: p } = await admin
    .from("profiles")
    .select("plan_type, subscription_status, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const deny = (code: string, message: string) => json({ error: { code, required, message } }, 403);
  if (!p) return deny("no_profile", "perfil não encontrado");
  if ((RANK[p.plan_type] ?? 0) < RANK[required]) return deny("plan_required", `requer plano ${required}`);
  if (p.subscription_status !== "active") return deny("subscription_inactive", "assinatura inativa");
  if (p.plan_expires_at) {
    const exp = new Date(p.plan_expires_at).getTime();
    if (Number.isFinite(exp) && exp + GRACE_MS < Date.now()) return deny("plan_expired", "plano expirado");
  }
  return null;
}

// ANTI-SPOOFING: the user id is derived ONLY from the verified JWT and is the
// sole source of identity for both the INSERT and the RPC. The request body
// never supplies user_id, so no one can read/write another user's memories.
async function authUser(req: Request): Promise<{ id: string } | Response> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: { message: "missing bearer token" } }, 401);
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return json({ error: { message: "invalid token" } }, 401);
  return { id: data.user.id };
}

async function embed(text: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!r.ok) {
    console.error("[memory-proxy] embedding failed:", r.status, await r.text());
    throw new Error("embedding_failed");
  }
  const j = await r.json();
  const v = j?.data?.[0]?.embedding;
  if (!Array.isArray(v)) throw new Error("embedding_failed");
  return v;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: { message: "method not allowed" } }, 405);

  const user = await authUser(req);
  if (user instanceof Response) return user;

  const denied = await guardPlan(user.id, "chat");
  if (denied) return denied;

  let body: {
    action?: string;
    content?: string;
    query?: string;
    match_threshold?: number;
    match_count?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: { message: "invalid JSON body" } }, 400);
  }

  try {
    if (body.action === "save") {
      const content = (body.content ?? "").trim();
      if (!content) return json({ error: { message: "content is required" } }, 400);

      const embedding = await embed(content);
      const { data, error } = await admin
        .from("memories")
        .insert({
          user_id: user.id,                  // from JWT — never from body
          content,
          embedding: JSON.stringify(embedding),
          is_explicit: true,
        })
        .select("id")
        .single();
      if (error) {
        console.error("[memory-proxy] insert failed:", error.message);
        return json({ error: { message: "failed to save memory" } }, 500);
      }
      return json({ ok: true, id: data.id });
    }

    if (body.action === "search") {
      const query = (body.query ?? "").trim();
      if (!query) return json({ error: { message: "query is required" } }, 400);

      const matchThreshold = typeof body.match_threshold === "number" ? body.match_threshold : 0.5;
      const matchCount = typeof body.match_count === "number" ? body.match_count : 5;

      const embedding = await embed(query);
      const { data, error } = await admin.rpc("match_memories", {
        p_user_id: user.id,                  // from JWT — never from body
        p_query_embedding: JSON.stringify(embedding),
        match_threshold: matchThreshold,
        match_count: matchCount,
      });
      if (error) {
        console.error("[memory-proxy] match_memories failed:", error.message);
        return json({ error: { message: "failed to search memories" } }, 500);
      }
      return json({ ok: true, matches: data ?? [] });
    }

    return json({ error: { message: "invalid action (expected 'save' or 'search')" } }, 400);
  } catch (e: unknown) {
    console.error("[memory-proxy] error:", e instanceof Error ? e.message : e);
    return json({ error: { message: "internal error" } }, 500);
  }
});
