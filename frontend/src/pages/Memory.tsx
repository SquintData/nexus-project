import { FormEvent, useEffect, useState } from "react";
import { Brain, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Modal } from "@/components/Modal";
import { useToast } from "@/lib/toast";
import type { Memory as MemoryRow } from "@/types";

const btnDelete = "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

export default function Memory() {
  const { toast } = useToast();
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("memory").select("*").order("updated_at", { ascending: false });
    setRows((data ?? []) as MemoryRow[]);
  }

  function closeAdd() { setAddOpen(false); setKey(""); setValue(""); }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("memory").upsert(
      { user_id: u.user.id, key: key.trim(), value: value.trim() },
      { onConflict: "user_id,key" },
    );
    closeAdd(); load(); toast("Memória salva");
  }

  async function remove(id: string) {
    await supabase.from("memory").delete().eq("id", id);
    load(); toast("Memória excluída");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Memória</h1>
          <p className="text-white/60 text-sm">Fatos pessoais que o Nexus usa para personalizar respostas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1" /> Adicionar
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Brain size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma memória ainda</p>
        </div>
      ) : (
        <table className="w-full glass p-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-white/50">
              <th className="px-3 py-2">Chave</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => { setKey(r.key); setValue(r.value); setAddOpen(true); }} title="Clique para editar">
                <td className="px-3 py-2 font-mono text-sm text-nexus-accent">{r.key}</td>
                <td className="px-3 py-2 text-sm">{r.value}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={(e) => { e.stopPropagation(); setConfirming(r.id); }} className={btnDelete}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={addOpen} onClose={closeAdd} title="Memória">
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="label">Chave</label>
            <input className="input" placeholder="ex: nome, profissao" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Valor</label>
            <input className="input" placeholder="valor" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={closeAdd}>Cancelar</button>
            <button className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirming} onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove(confirming)} label="esta memória" />
    </div>
  );
}
