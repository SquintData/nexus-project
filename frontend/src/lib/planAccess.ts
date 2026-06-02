const RANK: Record<string, number> = { free: 0, chat: 1, voice: 2 };

export function hasAccess(userPlan: string, required: string): boolean {
  return (RANK[userPlan] ?? 0) >= (RANK[required] ?? 0);
}

// Mirror of the server-side guardPlan grace window (PLAN_EXPIRY_GRACE_HOURS,
// default 48h) so the UI predicts the proxies' 403s instead of diverging.
const GRACE_MS = 48 * 60 * 60 * 1000;

interface PlanFields {
  plan_type: string;
  subscription_status: string;
  plan_expires_at: string | null;
}

// Active = subscription active AND not past expiry + grace. NULL expiry = no
// expiry (allowed). Matches the proxies' guardPlan.
export function isPlanActive(p: PlanFields): boolean {
  if (p.subscription_status !== "active") return false;
  if (p.plan_expires_at) {
    const exp = new Date(p.plan_expires_at).getTime();
    if (Number.isFinite(exp) && exp + GRACE_MS < Date.now()) return false;
  }
  return true;
}

// Full entitlement: active AND rank >= required. Use for route/feature gating.
export function hasPlan(p: PlanFields, required: string): boolean {
  return isPlanActive(p) && hasAccess(p.plan_type, required);
}
