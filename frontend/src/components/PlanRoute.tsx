import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { hasAccess } from "@/lib/planAccess";

export function PlanRoute({
  requiredPlan,
  children,
}: {
  requiredPlan: string;
  children: ReactNode;
}) {
  const { profile, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center text-white/60">Carregando…</div>;
  if (
    !profile ||
    !hasAccess(profile.plan_type, requiredPlan) ||
    profile.subscription_status !== "active"
  ) {
    return <Navigate to="/upgrade" replace />;
  }
  return <>{children}</>;
}
