import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import type { Task, TaskStatus } from "@/types";

const COLS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "A Fazer" },
  { key: "doing", label: "Fazendo" },
  { key: "done", label: "Feito" },
];

const btnEdit = "p-1.5 rounded-lg bg-nexus-accent/10 border border-nexus-accent/20 text-nexus-accent/60 hover:bg-nexus-accent/20 hover:text-nexus-accent transition-colors";
const btnDelete = "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

function SortableCard({
  task,
  onEdit,
  onRemove,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onRemove: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="group bg-black/30 border border-white/10 rounded-lg p-3 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm">{task.title}</span>
        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className={btnEdit}
          >
            <Pencil size={12} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(task); }}
            className={btnDelete}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-white/50 mt-1 line-clamp-2">{task.description}</p>
      )}
      {task.priority > 0 && (
        <span className="mt-2 inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-nexus-accent/10 text-nexus-accent">
          P{task.priority}
        </span>
      )}
    </li>
  );
}

function DroppableColumn({
  col,
  tasks,
  onEdit,
  onRemove,
  className,
}: {
  col: { key: TaskStatus; label: string };
  tasks: Task[];
  onEdit: (t: Task) => void;
  onRemove: (t: Task) => void;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id: col.key });
  return (
    <div ref={setNodeRef} className={cn("glass p-4 min-h-[60vh]", className)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{col.label}</h2>
        <span className="text-xs text-white/40">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </ul>
      </SortableContext>
      {tasks.length === 0 && (
        <p className="text-xs text-white/25 text-center pt-6">Nenhuma tarefa</p>
      )}
    </div>
  );
}

export default function Kanban() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("todo");
  const [editPriority, setEditPriority] = useState(0);
  const [confirming, setConfirming] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    load();
    const ch = supabase
      .channel("rt-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const { data } = await supabase
      .from("tasks").select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setTasks((data ?? []) as Task[]);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!addTitle.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("tasks").insert({ title: addTitle.trim(), user_id: u.user.id });
    setAddTitle(""); setAddOpen(false);
    toast("Tarefa adicionada");
  }

  async function remove(t: Task) {
    await supabase.from("tasks").delete().eq("id", t.id);
    toast("Tarefa excluída");
  }

  function openEdit(t: Task) {
    setEditing(t); setEditTitle(t.title);
    setEditDesc(t.description ?? ""); setEditStatus(t.status); setEditPriority(t.priority);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !editTitle.trim()) return;
    await supabase.from("tasks").update({
      title: editTitle.trim(), description: editDesc.trim() || null,
      status: editStatus, priority: editPriority,
    }).eq("id", editing.id);
    setEditing(null); toast("Tarefa atualizada");
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    const destStatus = COLS.find((c) => c.key === overId)?.key ?? tasks.find((t) => t.id === overId)?.status;
    if (!destStatus) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === destStatus) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: destStatus } : t)));
    supabase.from("tasks").update({ status: destStatus }).eq("id", taskId);
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kanban</h1>
          <p className="text-white/60 text-sm">{tasks.length} tarefa(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1" /> Adicionar
        </button>
      </header>

      <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(String(active.id))} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:snap-none">
          {COLS.map((c) => (
            <DroppableColumn key={c.key} col={c} tasks={tasks.filter((t) => t.status === c.key)}
              onEdit={openEdit} onRemove={(t) => setConfirming(t)} className="min-w-[82vw] snap-center md:min-w-0" />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="bg-black/30 border border-nexus-accent/40 rounded-lg p-3 shadow-lg">
              <span className="text-sm">{activeTask.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setAddTitle(""); }} title="Nova tarefa">
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="label">Título</label>
            <input className="input" placeholder="Nome da tarefa..." value={addTitle} onChange={(e) => setAddTitle(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => { setAddOpen(false); setAddTitle(""); }}>Cancelar</button>
            <button className="btn btn-primary">Adicionar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar tarefa">
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="label">Título</label>
            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input min-h-[60px]" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)}>
                {COLS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioridade</label>
              <input type="number" min={0} max={10} className="input" value={editPriority} onChange={(e) => setEditPriority(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirming} onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove(confirming)} label="esta tarefa" />
    </div>
  );
}
