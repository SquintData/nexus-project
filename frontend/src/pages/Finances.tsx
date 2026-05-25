import { FormEvent, useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Plus, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import type { Transaction, TransactionType } from "@/types";

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

interface Summary { balance: number; monthIncome: number; monthExpense: number }

const btnDelete = "p-1.5 rounded-lg bg-nexus-error/10 border border-nexus-error/20 text-nexus-error/60 hover:bg-nexus-error/20 hover:text-nexus-error transition-colors";

export default function Finances() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ balance: 0, monthIncome: 0, monthExpense: 0 });
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [formType, setFormType] = useState<TransactionType>("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");

  useEffect(() => {
    loadTransactions(selectedMonth);
    loadSummary(selectedMonth);
    const ch = supabase
      .channel("rt-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        loadTransactions(selectedMonth);
        loadSummary(selectedMonth);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedMonth]);

  async function loadTransactions(month: string) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1)).toISOString();
    const end = new Date(Date.UTC(mon === 12 ? year + 1 : year, mon === 12 ? 0 : mon, 1)).toISOString();
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    setTransactions((data ?? []) as Transaction[]);
  }

  async function loadSummary(month: string) {
    const { data } = await supabase.from("transactions").select("type,amount,created_at");
    if (!data) return;
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
    let balance = 0, monthIncome = 0, monthExpense = 0;
    for (const r of data) {
      const amt = Number(r.amount);
      balance += r.type === "income" ? amt : -amt;
      const ts = new Date(r.created_at);
      if (ts >= monthStart && ts < monthEnd) {
        if (r.type === "income") monthIncome += amt;
        else monthExpense += amt;
      }
    }
    setSummary({ balance, monthIncome, monthExpense });
  }

  function defaultFormDate(): string {
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    if (selectedMonth === todayMonth) {
      return today.toISOString().slice(0, 10);
    }
    return `${selectedMonth}-01`;
  }

  function openAdd() {
    setFormDate(defaultFormDate());
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    setFormType("expense");
    setFormAmount("");
    setFormDesc("");
    setFormDate("");
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Anchor at noon UTC to avoid timezone shifting the date one day
      const createdAt = formDate
        ? new Date(`${formDate}T12:00:00Z`).toISOString()
        : new Date().toISOString();
      await supabase.from("transactions").insert({
        user_id: u.user.id,
        type: formType,
        amount,
        description: formDesc.trim() || null,
        created_at: createdAt,
      });
      closeAdd();
      toast(formType === "income" ? "Recebimento registrado" : "Gasto registrado");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await supabase.from("transactions").delete().eq("id", id);
    toast("Transação excluída");
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finanças</h1>
          <p className="text-white/60 text-sm">{transactions.length} transação(ões) no mês</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} className="mr-1" /> Nova
        </button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass p-4 space-y-1">
          <p className="text-xs text-white/40 uppercase tracking-wider">Saldo total</p>
          <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {fmt(summary.balance)}
          </p>
        </div>
        <div className="glass p-4 space-y-1">
          <p className="text-xs text-white/40 uppercase tracking-wider">Entradas (mês)</p>
          <p className="text-2xl font-bold text-green-400">+{fmt(summary.monthIncome)}</p>
        </div>
        <div className="glass p-4 space-y-1">
          <p className="text-xs text-white/40 uppercase tracking-wider">Saídas (mês)</p>
          <p className="text-2xl font-bold text-red-400">-{fmt(summary.monthExpense)}</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
          title="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="px-4 py-1.5 rounded-lg glass min-w-[180px] text-center">
          <span className="text-sm font-medium capitalize">{monthLabel(selectedMonth)}</span>
        </div>
        <button
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
          title="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
        {selectedMonth !== currentMonth() && (
          <button
            onClick={() => setSelectedMonth(currentMonth())}
            className="text-xs text-white/50 hover:text-white px-2"
          >
            Hoje
          </button>
        )}
      </div>

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Wallet size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma transação neste mês</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="glass p-4 flex items-center gap-4">
              {t.type === "income" ? (
                <ArrowUpCircle size={20} className="text-green-400 shrink-0" />
              ) : (
                <ArrowDownCircle size={20} className="text-red-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${t.type === "income" ? "text-green-400" : "text-red-400"}`}>
                  {t.type === "income" ? "+" : "-"}{fmt(Number(t.amount))}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {t.description ?? <em className="text-white/30">sem descrição</em>}
                </p>
              </div>
              <span className="text-xs text-white/40 shrink-0">
                {new Date(t.created_at).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <button onClick={() => setPendingDelete(t.id)} className={btnDelete}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal open={addOpen} onClose={closeAdd} title="Nova transação">
        <form onSubmit={add} className="space-y-4">
          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-3">
              {(["expense", "income"] as TransactionType[]).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={formType === t}
                    onChange={() => setFormType(t)}
                    className="accent-nexus-accent"
                  />
                  <span className={t === "income" ? "text-green-400" : "text-red-400"}>
                    {t === "income" ? "Entrada" : "Saída"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Data</label>
            <input
              className="input"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Descrição (opcional)</label>
            <input
              className="input"
              placeholder="ex: mercado, salário..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={closeAdd}>Cancelar</button>
            <button
              className="btn btn-primary"
              disabled={busy || !formAmount || Number(formAmount) <= 0}
            >
              {busy ? "..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        label="esta transação"
      />
    </div>
  );
}
