import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  KanbanSquare,
  Calendar,
  Lightbulb,
  Workflow,
  Brain,
  Wallet,
  Flame,
  BookOpen,
  MessageCircle,
  Plug,
  LogOut,
  Lock,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { hasPlan } from "@/lib/planAccess";
import { useBillingPortal } from "@/lib/useBillingPortal";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/chat", label: "Chat IA", icon: MessageCircle, requiredPlan: "chat" as const },
  { to: "/app/agente", label: "Parear agente", icon: Plug, requiredPlan: "voice" as const },
  { to: "/app/kanban", label: "Tarefas", icon: KanbanSquare },
  { to: "/app/agenda", label: "Agenda", icon: Calendar },
  { to: "/app/ideias", label: "Ideias", icon: Lightbulb },
  { to: "/app/rotinas", label: "Rotinas", icon: Workflow },
  { to: "/app/memoria", label: "Memória", icon: Brain },
  { to: "/app/financas", label: "Finanças", icon: Wallet },
  { to: "/app/habitos", label: "Hábitos", icon: Flame },
  { to: "/app/diario", label: "Diário", icon: BookOpen },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const { openPortal, loading: portalLoading, error: portalError } = useBillingPortal();
  const isSubscriber = !!profile && profile.plan_type !== "free" && !!profile.stripe_customer_id;
  return (
    <aside className="w-64 glass-strong m-3 mr-0 p-5 flex flex-col h-[calc(100vh-24px)]">
      <div className="px-1 mb-8 flex items-center gap-3">
        <img
          src="/nexus-logo.png"
          alt="Nexus"
          className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]"
        />
        <span className="text-[19px] font-semibold tracking-tight text-white">
          NEXUS
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 -mx-1">
        {NAV.map(({ to, label, icon: Icon, requiredPlan }) => {
          const locked =
            !!requiredPlan && (!profile || !hasPlan(profile, requiredPlan));

          if (locked) {
            return (
              <Link
                key={to}
                to={`/upgrade?plan=${requiredPlan}`}
                onClick={onClose}
                className="nav-link text-white/25 hover:bg-white/[0.02] hover:text-white/35 border border-transparent"
              >
                <Icon size={17} strokeWidth={1.8} className="opacity-40" />
                <span className="flex-1">{label}</span>
                <Lock size={12} strokeWidth={2.2} className="opacity-50" />
              </Link>
            );
          }

          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/app"}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "nav-link",
                  isActive
                    ? "bg-white/[0.07] text-white border border-white/10 shadow-glow-soft"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white border border-transparent",
                )
              }
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <div className="px-2 mb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/30">
            Conta
          </div>
          <div className="text-xs text-white/55 truncate mt-1">{user?.email}</div>
        </div>
        {isSubscriber && (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="nav-link w-full text-white/50 hover:bg-white/[0.04] hover:text-white border border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CreditCard size={17} strokeWidth={1.4} />
            {portalLoading ? "Abrindo..." : "Gerenciar Assinatura"}
          </button>
        )}
        {portalError && (
          <p className="px-2 mt-1 text-[11px] text-red-400">{portalError}</p>
        )}
        <button
          onClick={signOut}
          className="nav-link w-full text-white/50 hover:bg-white/[0.04] hover:text-white border border-transparent"
        >
          <LogOut size={17} strokeWidth={1.4} />
          Sair
        </button>
      </div>
    </aside>
  );
}
