import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import type { Routine } from "@/types";

type Action = { type: "app" | "url"; target: string };

const btnEdit = "p-1.5 rounded-lg bg-nexus-accent/10 border border-nexus-accent/20 text-nexus-accent/60 hover:bg-nexus-accent/20 hover:text-nexus-accent transition-colors";
const btnDelete = "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

function ActionBuilder({
  list,
  onUpdate,
  onAdd,
  onRemove,
}: {
  list: Action[];
  onUpdate: (i: number, p: Partial<Action>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      {list.map((a, i) => (
        <div key={i} className="flex gap-2">
          <select className="input w-28" value={a.type} onChange={(e) => onUpdate(i, { type: e.target.value as Action["type"] })}>
            <option value="app">App</option>
            <option value="url">URL</option>
          </select>
          <input className="input flex-1" placeholder={a.type === "app" ? "ex: vs code" : "https://..."} value={a.target} onChange={(e) => onUpdate(i, { target: e.target.value })} />
          {list.length > 1 && (
            <button type="button" className="btn" onClick={() => onRemove(i)}><Trash2 size={14} /></button>
          )}
        </div>
      ))}
      <button type="button" className="btn text-xs" onClick={onAdd}>
        <Plus size={14} className="mr-1" /> Ação
      </button>
    </div>
  );
}

export default function Routines() {
  const { toast } = useToast();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [actions, setActions] = useState<Action[]>([{ type: "app", target: "" }]);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [editName, setEditName] = useState("");
  const [editActions, setEditActions] = useState<Action[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("routines").select("*").order("created_at", { ascending: false });
    setRoutines((data ?? []) as Routine[]);
  }

  function closeAdd() { setAddOpen(false); setName(""); setActions([{ type: "app", target: "" }]); }

  async function add(e: FormEvent) {
    e.preventDefault();
    const cleaned = actions.filter((a) => a.target.trim());
    if (!name.trim() || cleaned.length === 0) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("routines").insert({ user_id: u.user.id, name: name.trim(), actions_json: cleaned });
    closeAdd(); load(); toast("Rotina salva");
  }

  async function remove(id: string) {
    await supabase.from("routines").delete().eq("id", id);
    load(); toast("Rotina excluída");
  }

  function openEdit(r: Routine) {
    setEditing(r); setEditName(r.name); setEditActions(r.actions_json.map((a) => ({ ...a })));
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    const cleaned = editActions.filter((a) => a.target.trim());
    if (cleaned.length === 0) return;
    await supabase.from("routines").update({ name: editName.trim(), actions_json: cleaned }).eq("id", editing.id);
    setEditing(null); load(); toast("Rotina atualizada");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rotinas</h1>
          <p className="text-white/60 text-sm">Comandos em lote acionados por voz</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1" /> Adicionar
        </button>
      </header>

      {routines.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Workflow size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma rotina ainda</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {routines.map((r) => (
            <li key={r.id} className="glass p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold">{r.name}</div>
                <ul className="mt-2 space-y-1 text-sm text-white/70">
                  {r.actions_json.map((a, i) => (
                    <li key={i}>
                      <span className="text-xs uppercase tracking-wider text-nexus-accent mr-2">{a.type}</span>
                      {a.target}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(r)} className={btnEdit}><Pencil size={13} /></button>
                <button onClick={() => setConfirming(r.id)} className={btnDelete}><Trash2 size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={addOpen} onClose={closeAdd} title="Nova rotina">
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" placeholder="ex: Modo Produtividade" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Ações</label>
            <ActionBuilder list={actions}
              onUpdate={(i, p) => setActions((arr) => arr.map((a, idx) => idx === i ? { ...a, ...p } : a))}
              onAdd={() => setActions((a) => [...a, { type: "app", target: "" }])}
              onRemove={(i) => setActions((arr) => arr.filter((_, idx) => idx !== i))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={closeAdd}>Cancelar</button>
            <button className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar rotina">
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="label">Ações</label>
            <ActionBuilder list={editActions}
              onUpdate={(i, p) => setEditActions((arr) => arr.map((a, idx) => idx === i ? { ...a, ...p } : a))}
              onAdd={() => setEditActions((a) => [...a, { type: "app", target: "" }])}
              onRemove={(i) => setEditActions((arr) => arr.filter((_, idx) => idx !== i))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirming} onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove(confirming)} label="esta rotina" />
    </div>
  );
}
