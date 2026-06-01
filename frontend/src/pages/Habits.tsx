import { FormEvent, useEffect, useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import type { Habit } from "@/types";

const btnDelete =
  "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function last30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function calcStreak(logSet: Set<string>): number {
  let streak = 0;
  const d = new Date();
  while (true) {
    const iso = d.toISOString().slice(0, 10);
    if (!logSet.has(iso)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

interface HabitWithLogs extends Habit {
  logs: Set<string>;
}

export default function Habits() {
  const { toast } = useToast();
  const [habits, setHabits] = useState<HabitWithLogs[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const days30 = last30Days();
  const today = todayUTC();

  useEffect(() => {
    load();
    const ch = supabase
      .channel("rt-habits")
      .on("postgres_changes", { event: "*", schema: "public", table: "habits" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_logs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const { data: habitsData } = await supabase
      .from("habits")
      .select("*")
      .order("created_at", { ascending: true });
    if (!habitsData) return;

    const cutoff = days30[0];
    const ids = habitsData.map((h) => h.id);
    if (ids.length === 0) { setHabits([]); return; }

    const { data: logsData } = await supabase
      .from("habit_logs")
      .select("habit_id,date")
      .in("habit_id", ids)
      .gte("date", cutoff);

    const logsByHabit: Record<string, Set<string>> = {};
    for (const h of habitsData) logsByHabit[h.id] = new Set();
    for (const l of logsData ?? []) logsByHabit[l.habit_id]?.add(l.date);

    setHabits(habitsData.map((h) => ({ ...h, logs: logsByHabit[h.id] })));
  }

  async function toggleToday(habit: HabitWithLogs) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (habit.logs.has(today)) {
      await supabase.from("habit_logs").delete().eq("habit_id", habit.id).eq("date", today);
    } else {
      await supabase
        .from("habit_logs")
        .upsert({ user_id: u.user.id, habit_id: habit.id, date: today }, { onConflict: "habit_id,date" });
    }
  }

  function closeAdd() { setAddOpen(false); setFormName(""); }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("habits").insert({ user_id: u.user.id, name: formName.trim() });
      closeAdd();
      toast("Hábito criado");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    await supabase.from("habits").delete().eq("id", id);
    toast("Hábito excluído");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">Hábitos</h1>
          <p className="text-white/55 text-sm mt-2">{habits.length} hábito(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1" /> Novo
        </button>
      </header>

      {habits.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Flame size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum hábito ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.map((h) => {
            const done = h.logs.has(today);
            const streak = calcStreak(h.logs);
            return (
              <div key={h.id} className="glass p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleToday(h)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                      done
                        ? "bg-nexus-accent border-nexus-accent text-white"
                        : "border-white/30 hover:border-nexus-accent"
                    }`}
                    title={done ? "Desmarcar hoje" : "Marcar como feito hoje"}
                  >
                    {done && <span className="text-xs">✓</span>}
                  </button>
                  <span className="flex-1 font-medium">{h.name}</span>
                  {streak > 0 && (
                    <span className="text-sm text-orange-400 flex items-center gap-1">
                      🔥 {streak}
                    </span>
                  )}
                  <button onClick={() => setPendingDelete(h.id)} className={btnDelete}>
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* 30-day grid */}
                <div className="flex gap-0.5 flex-wrap">
                  {days30.map((d) => (
                    <div
                      key={d}
                      title={d}
                      className={`w-4 h-4 rounded-sm transition-colors ${
                        h.logs.has(d)
                          ? "bg-nexus-accent"
                          : "bg-white/10"
                      } ${d === today ? "ring-1 ring-white/40" : ""}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={closeAdd} title="Novo hábito">
        <form onSubmit={add} className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              placeholder="ex: Meditação, Exercício, Leitura..."
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={closeAdd}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy || !formName.trim()}>
              {busy ? "..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        label="este hábito"
      />
    </div>
  );
}
