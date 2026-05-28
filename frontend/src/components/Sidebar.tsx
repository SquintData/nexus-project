import { NavLink } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/kanban", label: "Tarefas", icon: KanbanSquare },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/ideias", label: "Ideias", icon: Lightbulb },
  { to: "/rotinas", label: "Rotinas", icon: Workflow },
  { to: "/memoria", label: "Memória", icon: Brain },
  { to: "/financas", label: "Finanças", icon: Wallet },
  { to: "/habitos", label: "Hábitos", icon: Flame },
  { to: "/diario", label: "Diário", icon: BookOpen },
  { to: "/agente", label: "Parear agente", icon: Plug },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, signOut } = useAuth();
  return (
    <aside className="w-64 glass-strong m-3 mr-0 p-5 flex flex-col h-[calc(100vh-24px)]">
      <div className="px-1 mb-8 flex items-center gap-2.5">
        <img
          src="/nexus-logo.svg"
          alt="Nexus"
          className="w-7 h-7 drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]"
        />
        <span className="text-[20px] font-light tracking-tightest text-white">
          NEXUS
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 -mx-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "nav-link",
                isActive
                  ? "bg-white/[0.06] text-white border border-white/10 shadow-glow-soft"
                  : "text-white/55 hover:bg-white/[0.03] hover:text-white border border-transparent",
              )
            }
          >
            <Icon size={17} strokeWidth={1.4} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <div className="px-2 mb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/30">
            Conta
          </div>
          <div className="text-xs text-white/55 truncate mt-1">{user?.email}</div>
        </div>
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
