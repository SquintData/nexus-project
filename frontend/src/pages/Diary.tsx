import { FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import type { DiaryEntry } from "@/types";

const btnDelete =
  "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function Diary() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null);
  const [editContent, setEditContent] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addContent, setAddContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const today = todayISO();

  useEffect(() => {
    load();
    const ch = supabase
      .channel("rt-diary")
      .on("postgres_changes", { event: "*", schema: "public", table: "diary_entries" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const { data } = await supabase
      .from("diary_entries")
      .select("*")
      .order("date", { ascending: false });
    setEntries((data ?? []) as DiaryEntry[]);
  }

  const entryByDate = Object.fromEntries(entries.map((e) => [e.date, e]));

  function handleCalDay(date: string) {
    if (!entryByDate[date]) return;
    setSelectedDate(date);
    setTimeout(() => {
      cardRefs.current[date]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function openAdd() {
    setAddContent("");
    setAddOpen(true);
  }

  async function saveAdd(e: FormEvent) {
    e.preventDefault();
    if (!addContent.trim()) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const existing = entryByDate[today];
      if (existing) {
        await supabase
          .from("diary_entries")
          .update({ content: existing.content + "\n\n" + addContent.trim(), updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("diary_entries").insert({
          user_id: u.user.id, date: today, content: addContent.trim(),
        });
      }
      setAddOpen(false);
      toast("Entrada salva");
    } finally { setBusy(false); }
  }

  function openEdit(entry: DiaryEntry) {
    setEditEntry(entry);
    setEditContent(entry.content);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editEntry || !editContent.trim()) return;
    await supabase
      .from("diary_entries")
      .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
      .eq("id", editEntry.id);
    setEditEntry(null);
    toast("Entrada atualizada");
  }

  async function remove(id: string) {
    await supabase.from("diary_entries").delete().eq("id", id);
    toast("Entrada excluída");
  }

  // Calendar rendering
  const totalDays = daysInMonth(calYear, calMonth);
  const startOffset = firstWeekday(calYear, calMonth);
  const calCells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diário</h1>
          <p className="text-white/60 text-sm">{entries.length} entrada(s)</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} className="mr-1" /> Hoje
        </button>
      </header>

      <div className="flex gap-6 items-start">
        {/* Mini calendar */}
        <div className="glass p-4 shrink-0 w-64 space-y-3">
          <div className="flex items-center justify-between">
            <button
              className="p-1 rounded hover:bg-white/10 transition-colors"
              onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium capitalize">{monthLabel(calYear, calMonth)}</span>
            <button
              className="p-1 rounded hover:bg-white/10 transition-colors"
              onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["D","S","T","Q","Q","S","S"].map((d, i) => (
              <div key={i} className="text-[10px] text-white/30 py-0.5">{d}</div>
            ))}
            {calCells.map((day, i) => {
              if (!day) return <div key={i} />;
              const iso = isoDate(calYear, calMonth, day);
              const hasEntry = !!entryByDate[iso];
              const isToday = iso === today;
              const isSelected = iso === selectedDate;
              return (
                <button
                  key={i}
                  onClick={() => handleCalDay(iso)}
                  disabled={!hasEntry}
                  className={`text-xs rounded py-0.5 relative transition-colors ${
                    isSelected
                      ? "bg-nexus-accent text-white"
                      : isToday
                      ? "ring-1 ring-nexus-accent/60 text-nexus-accent"
                      : hasEntry
                      ? "hover:bg-white/10 text-white"
                      : "text-white/20 cursor-default"
                  }`}
                >
                  {day}
                  {hasEntry && !isSelected && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-nexus-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Entry list */}
        <div className="flex-1 space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma entrada ainda</p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                ref={(el) => { cardRefs.current[entry.date] = el; }}
                className={`glass p-4 space-y-2 transition-colors cursor-pointer ${
                  selectedDate === entry.date ? "ring-1 ring-nexus-accent/50" : ""
                }`}
                onClick={() => openEdit(entry)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-nexus-accent capitalize">
                    {formatDate(entry.date)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(entry.id); }}
                    className={btnDelete}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-sm text-white/80 line-clamp-3 whitespace-pre-wrap">{entry.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`Entrada de hoje — ${formatDate(today)}`}>
        <form onSubmit={saveAdd} className="space-y-4">
          <textarea
            className="input min-h-[160px] resize-none"
            placeholder="O que aconteceu hoje?"
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy || !addContent.trim()}>
              {busy ? "..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editEntry} onClose={() => setEditEntry(null)} title={editEntry ? formatDate(editEntry.date) : ""}>
        <form onSubmit={saveEdit} className="space-y-4">
          <textarea
            className="input min-h-[200px] resize-none"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setEditEntry(null)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!editContent.trim()}>Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        label="esta entrada do diário"
      />
    </div>
  );
}
