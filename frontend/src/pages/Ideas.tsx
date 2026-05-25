import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ImagePlus, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import type { Idea } from "@/types";

const btnEdit = "p-1.5 rounded-lg bg-nexus-accent/10 border border-nexus-accent/20 text-nexus-accent/60 hover:bg-nexus-accent/20 hover:text-nexus-accent transition-colors";
const btnDelete = "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

export default function Ideas() {
  const { toast } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [content, setContent] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTagsStr, setEditTagsStr] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    load();
    const ch = supabase.channel("rt-ideas")
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const { data } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
    setIdeas((data ?? []) as Idea[]);
  }

  function closeAdd() { setAddOpen(false); setContent(""); setTagsStr(""); setFile(null); }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      let photo_url: string | null = null;
      if (file) {
        const path = `${u.user.id}/${Date.now()}-${file.name}`;
        const { error: uerr } = await supabase.storage.from("idea-photos").upload(path, file);
        if (!uerr) {
          const { data } = supabase.storage.from("idea-photos").getPublicUrl(path);
          photo_url = data.publicUrl;
        }
      }
      const tags = tagsStr.split(",").map((s) => s.trim()).filter(Boolean);
      await supabase.from("ideas").insert({ user_id: u.user.id, content: content.trim(), tags, photo_url });
      closeAdd(); toast("Ideia salva");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    await supabase.from("ideas").delete().eq("id", id);
    toast("Ideia excluída");
  }

  function openEdit(i: Idea) {
    setEditing(i); setEditContent(i.content); setEditTagsStr(i.tags.join(", "));
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !editContent.trim()) return;
    const tags = editTagsStr.split(",").map((s) => s.trim()).filter(Boolean);
    await supabase.from("ideas").update({ content: editContent.trim(), tags }).eq("id", editing.id);
    setEditing(null); toast("Ideia atualizada");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ideias</h1>
          <p className="text-white/60 text-sm">{ideas.length} ideia(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1" /> Adicionar
        </button>
      </header>

      {ideas.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Lightbulb size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma ideia ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((i) => (
            <article key={i.id} className="glass p-4 space-y-2">
              {i.photo_url && (
                <img src={i.photo_url} alt="" className="w-full h-40 object-cover rounded-lg border border-white/10" />
              )}
              <p className="text-sm whitespace-pre-wrap">{i.content}</p>
              {i.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {i.tags.map((t) => (
                    <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-nexus-accent/10 text-nexus-accent">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-xs text-white/40">{new Date(i.created_at).toLocaleDateString("pt-BR")}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(i)} className={btnEdit}><Pencil size={12} /></button>
                  <button onClick={() => setConfirming(i.id)} className={btnDelete}><Trash2 size={12} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={closeAdd} title="Nova ideia">
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="label">Conteúdo</label>
            <textarea className="input min-h-[100px]" placeholder="Escreva sua ideia..." value={content} onChange={(e) => setContent(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Tags</label>
            <input className="input" placeholder="tags, separadas, por, vírgula" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
          </div>
          <label className="btn cursor-pointer w-full justify-center">
            <ImagePlus size={16} className="mr-2" />
            {file ? file.name.slice(0, 24) : "Anexar foto"}
            <input type="file" accept="image/*" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={closeAdd}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "..." : "Salvar"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar ideia">
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="label">Conteúdo</label>
            <textarea className="input min-h-[100px]" value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          </div>
          <div>
            <label className="label">Tags</label>
            <input className="input" placeholder="tags, separadas, por, vírgula" value={editTagsStr} onChange={(e) => setEditTagsStr(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirming} onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove(confirming)} label="esta ideia" />
    </div>
  );
}
