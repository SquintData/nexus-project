import { FormEvent, useEffect, useState } from "react";
import { Calendar, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import type { Event } from "@/types";

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const btnEdit = "p-1.5 rounded-lg bg-nexus-accent/10 border border-nexus-accent/20 text-nexus-accent/60 hover:bg-nexus-accent/20 hover:text-nexus-accent transition-colors";
const btnDelete = "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

export default function Agenda() {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [location, setLocation] = useState("");
  const [editing, setEditing] = useState<Event | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    load();
    const ch = supabase.channel("rt-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const { data } = await supabase.from("events").select("*").order("start_at", { ascending: true });
    setEvents((data ?? []) as Event[]);
  }

  function closeAdd() { setAddOpen(false); setTitle(""); setStartAt(""); setLocation(""); }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startAt) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("events").insert({
      user_id: u.user.id, title: title.trim(),
      start_at: new Date(startAt).toISOString(), location: location.trim() || null,
    });
    closeAdd(); toast("Compromisso adicionado");
  }

  async function remove(id: string) {
    await supabase.from("events").delete().eq("id", id);
    toast("Compromisso excluído");
  }

  function openEdit(ev: Event) {
    setEditing(ev); setEditTitle(ev.title);
    setEditStartAt(isoToLocalInput(ev.start_at)); setEditLocation(ev.location ?? "");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !editTitle.trim() || !editStartAt) return;
    await supabase.from("events").update({
      title: editTitle.trim(), start_at: new Date(editStartAt).toISOString(),
      location: editLocation.trim() || null,
    }).eq("id", editing.id);
    setEditing(null); toast("Compromisso atualizado");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">Agenda</h1>
          <p className="text-white/55 text-sm mt-2">{events.length} compromisso(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1" /> Adicionar
        </button>
      </header>

      {events.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Calendar size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum compromisso ainda</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="glass p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{ev.title}</div>
                <div className="text-xs text-white/50 flex flex-wrap items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {new Date(ev.start_at).toLocaleString("pt-BR")}
                  </span>
                  {ev.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {ev.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(ev)} className={btnEdit}><Pencil size={13} /></button>
                <button onClick={() => setConfirming(ev.id)} className={btnDelete}><Trash2 size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={addOpen} onClose={closeAdd} title="Novo compromisso">
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="label">Título</label>
            <input className="input" placeholder="Nome do evento..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Data e hora</label>
            <input type="datetime-local" className="input" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <label className="label">Local</label>
            <input className="input" placeholder="opcional" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={closeAdd}>Cancelar</button>
            <button className="btn btn-primary">Adicionar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar compromisso">
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="label">Título</label>
            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Data e hora</label>
            <input type="datetime-local" className="input" value={editStartAt} onChange={(e) => setEditStartAt(e.target.value)} />
          </div>
          <div>
            <label className="label">Local</label>
            <input className="input" placeholder="opcional" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirming} onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove(confirming)} label="este compromisso" />
    </div>
  );
}
