const RANK: Record<string, number> = { free: 0, chat: 1, voice: 2 };

export function hasAccess(userPlan: string, required: string): boolean {
  return (RANK[userPlan] ?? 0) >= (RANK[required] ?? 0);
}
