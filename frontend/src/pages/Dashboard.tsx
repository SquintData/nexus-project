import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

import { Sphere } from "@/components/Sphere";
import { Modal } from "@/components/Modal";
import { supabase } from "@/lib/supabase";
import { useAgentState } from "@/lib/useAgentState";
import { usePreference } from "@/lib/usePreference";

// ---------- Card catalog ----------
type CardId =
  | "tasks_pending"
  | "tasks_done_today"
  | "events_next7"
  | "events_next"
  | "habits_today"
  | "balance_total"
  | "balance_month"
  | "ideas_total";

interface CardDef {
  id: CardId;
  label: string;
  component: () => JSX.Element;
}

const DEFAULT_CARDS: CardId[] = ["tasks_pending", "events_next7", "habits_today"];

const CARDS: CardDef[] = [
  { id: "tasks_pending", label: "Tarefas pendentes", component: TasksPendingCard },
  { id: "tasks_done_today", label: "Tarefas concluídas hoje", component: TasksDoneTodayCard },
  { id: "events_next7", label: "Próximos 7 dias", component: EventsNext7Card },
  { id: "events_next", label: "Próximo compromisso", component: NextEventCard },
  { id: "habits_today", label: "Hábitos hoje", component: HabitsTodayCard },
  { id: "balance_total", label: "Saldo total", component: BalanceTotalCard },
  { id: "balance_month", label: "Saldo do mês", component: BalanceMonthCard },
  { id: "ideas_total", label: "Ideias", component: IdeasTotalCard },
];

// ---------- Page ----------
export default function Dashboard() {
  const state = useAgentState();
  const { value: selected, setValue: setSelected, loaded } = usePreference<CardId[]>(
    "dashboard.cards",
    DEFAULT_CARDS,
  );
  const [configOpen, setConfigOpen] = useState(false);

  const visibleCards = CARDS.filter((c) => selected.includes(c.id));

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-white/60 text-sm">Diga "Olá, Nexus" para começar.</p>
        </div>
        <button
          onClick={() => setConfigOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          title="Configurar cards"
        >
          <Settings size={18} />
        </button>
      </header>

      <div className="grid place-items-center py-8">
        <Sphere state={state} />
      </div>

      {loaded && visibleCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleCards.map((c) => {
            const Comp = c.component;
            return <Comp key={c.id} />;
          })}
        </div>
      )}
      {loaded && visibleCards.length === 0 && (
        <div className="text-center text-white/40 text-sm py-8">
          Nenhum card selecionado. <button onClick={() => setConfigOpen(true)} className="underline hover:text-white">Configurar</button>
        </div>
      )}

      <ConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        selected={selected}
        onChange={setSelected}
      />
    </div>
  );
}

// ---------- Config modal ----------
function ConfigModal({
  open,
  onClose,
  selected,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  selected: CardId[];
  onChange: (v: CardId[]) => Promise<void>;
}) {
  function toggle(id: CardId) {
    const next = selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id];
    onChange(next);
  }
  return (
    <Modal open={open} onClose={onClose} title="Configurar cards do dashboard">
      <div className="space-y-2">
        {CARDS.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={() => toggle(c.id)}
              className="accent-nexus-accent w-4 h-4"
            />
            <span className="text-sm">{c.label}</span>
          </label>
        ))}
        <div className="flex justify-end pt-2">
          <button className="btn btn-primary" onClick={onClose}>Pronto</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Card primitive ----------
function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  const valueColor =
    tone === "positive" ? "text-green-400" : tone === "negative" ? "text-red-400" : "";
  return (
    <div className="glass p-4">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {hint && <div className="text-xs text-white/40 mt-1">{hint}</div>}
    </div>
  );
}

function useCount(fetcher: () => Promise<number>): number {
  const [n, setN] = useState(0);
  useEffect(() => { fetcher().then(setN); }, [fetcher]);
  return n;
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------- Card components ----------
function TasksPendingCard() {
  const n = useCount(async () => {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["todo", "doing"]);
    return count ?? 0;
  });
  return <StatCard label="Tarefas pendentes" value={n} />;
}

function TasksDoneTodayCard() {
  const n = useCount(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "done")
      .gte("updated_at", startOfDay.toISOString());
    return count ?? 0;
  });
  return <StatCard label="Concluídas hoje" value={n} />;
}

function EventsNext7Card() {
  const n = useCount(async () => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("start_at", now.toISOString())
      .lt("start_at", in7.toISOString());
    return count ?? 0;
  });
  return <StatCard label="Próximos 7 dias" value={n} />;
}

function NextEventCard() {
  const [title, setTitle] = useState<string>("—");
  const [hint, setHint] = useState<string | undefined>();
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("title,start_at")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(1);
      const e = data?.[0];
      if (!e) { setTitle("Nenhum"); setHint(undefined); return; }
      setTitle(e.title);
      setHint(new Date(e.start_at).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      }));
    })();
  }, []);
  return (
    <div className="glass p-4">
      <div className="text-xs uppercase tracking-wider text-white/50">Próximo compromisso</div>
      <div className="text-lg font-semibold mt-1 truncate">{title}</div>
      {hint && <div className="text-xs text-white/40 mt-1">{hint}</div>}
    </div>
  );
}

function HabitsTodayCard() {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: totalCount }, { count: doneCount }] = await Promise.all([
        supabase.from("habits").select("id", { count: "exact", head: true }),
        supabase
          .from("habit_logs")
          .select("id", { count: "exact", head: true })
          .eq("date", today),
      ]);
      setTotal(totalCount ?? 0);
      setDone(doneCount ?? 0);
    })();
  }, []);
  return (
    <StatCard
      label="Hábitos hoje"
      value={`${done}/${total}`}
      tone={total > 0 && done === total ? "positive" : "default"}
    />
  );
}

function BalanceTotalCard() {
  const [bal, setBal] = useState(0);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("transactions").select("type,amount");
      let b = 0;
      for (const r of data ?? []) {
        const amt = Number(r.amount);
        b += r.type === "income" ? amt : -amt;
      }
      setBal(b);
    })();
  }, []);
  return <StatCard label="Saldo total" value={brl(bal)} tone={bal >= 0 ? "positive" : "negative"} />;
}

function BalanceMonthCard() {
  const [bal, setBal] = useState(0);
  useEffect(() => {
    (async () => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
      const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)).toISOString();
      const { data } = await supabase
        .from("transactions")
        .select("type,amount")
        .gte("created_at", start)
        .lt("created_at", end);
      let b = 0;
      for (const r of data ?? []) {
        const amt = Number(r.amount);
        b += r.type === "income" ? amt : -amt;
      }
      setBal(b);
    })();
  }, []);
  return <StatCard label="Saldo do mês" value={brl(bal)} tone={bal >= 0 ? "positive" : "negative"} />;
}

function IdeasTotalCard() {
  const n = useCount(async () => {
    const { count } = await supabase.from("ideas").select("id", { count: "exact", head: true });
    return count ?? 0;
  });
  return <StatCard label="Ideias" value={n} />;
}
