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
  { to: "/kanban", label: "Kanban", icon: KanbanSquare },
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
    <aside className="w-64 glass m-3 mr-0 p-4 flex flex-col h-[calc(100vh-24px)]">
      <div className="px-2 mb-6">
        <div className="text-2xl font-bold tracking-tight">
          <span className="text-nexus-accent">Ne</span>xus
        </div>
        <div className="text-xs text-white/40 truncate">{user?.email}</div>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                isActive
                  ? "bg-nexus-accent/15 text-nexus-accent border border-nexus-accent/30"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white"
      >
        <LogOut size={18} />
        Sair
      </button>
    </aside>
  );
}
