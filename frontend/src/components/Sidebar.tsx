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
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { hasPlan, planLabel } from "@/lib/planAccess";
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

      <div className="mt-5 pt-5 border-t border-white/[0.06]">
        <div className="min-w-0 px-3 py-3 mb-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">
              Conta
            </span>
            {profile && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] border border-white/10 text-white/70 whitespace-nowrap">
                {planLabel(profile.plan_type)}
              </span>
            )}
          </div>
          <div
            className="block w-full truncate text-xs text-white/55"
            title={user?.email ?? undefined}
          >
            {user?.email}
          </div>
        </div>
        <NavLink
          to="/app/conta"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              "nav-link w-full border",
              isActive
                ? "bg-white/[0.07] text-white border-white/10"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white border-transparent",
            )
          }
        >
          <User size={17} strokeWidth={1.4} />
          Assinatura
        </NavLink>
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
