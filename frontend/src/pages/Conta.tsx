import { Link } from "react-router-dom";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/useSubscription";
import { useBillingPortal } from "@/lib/useBillingPortal";

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  chat: "Nexus Chat",
  voice: "Nexus Voice",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Período de teste",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  unpaid: "Não paga",
  incomplete: "Incompleta",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function fmtMoney(amount?: number | null, currency?: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: (currency ?? "BRL").toUpperCase(),
    }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2)}`;
  }
}

export default function Conta() {
  const { user, profile } = useAuth();
  const { data, loading, error, refetch } = useSubscription();
  const { openPortal, loading: portalLoading, error: portalError } = useBillingPortal();

  const planType = data?.plan_type ?? profile?.plan_type ?? "free";
  const isSubscriber =
    planType !== "free" && (data?.subscribed ?? !!profile?.stripe_customer_id);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Conta</h1>
      <p className="text-white/50 text-sm mb-8 truncate">{user?.email}</p>

      {!isSubscriber ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
          <h2 className="font-semibold text-lg mb-1">Plano Free</h2>
          <p className="text-white/50 text-sm mb-5">
            Sem recursos de IA. Faça upgrade pra liberar o assistente.
          </p>
          <Link
            to="/upgrade"
            className="inline-block px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:opacity-90"
          >
            Fazer upgrade
          </Link>
        </div>
      ) : error && !data ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
          <h2 className="font-semibold text-lg mb-1">
            Não foi possível carregar sua assinatura
          </h2>
          <p className="text-white/50 text-sm mb-5">
            Tivemos um problema ao buscar seus dados de cobrança. Tente novamente
            em instantes.
          </p>
          <button
            onClick={refetch}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white/40 text-xs uppercase tracking-wider mb-1">
                  Plano
                </div>
                <div className="text-lg font-semibold">
                  {PLAN_LABEL[planType] ?? planType}
                </div>
              </div>
              {data?.status && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.06] border border-white/10">
                  {STATUS_LABEL[data.status] ?? data.status}
                </span>
              )}
            </div>

            {loading && !data ? (
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <Loader2 size={14} className="animate-spin" /> Carregando detalhes…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-white/40 text-xs mb-0.5">Valor</div>
                  <div>
                    {fmtMoney(data?.amount, data?.currency)}
                    {data?.interval
                      ? data.interval === "year"
                        ? "/ano"
                        : "/mês"
                      : ""}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-0.5">
                    {data?.cancel_at_period_end ? "Cancela em" : "Próxima cobrança"}
                  </div>
                  <div>{fmtDate(data?.current_period_end)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-white/40 text-xs mb-0.5">
                    Forma de pagamento
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={14} className="text-white/50" />
                    {data?.card
                      ? `${data.card.brand} •••• ${data.card.last4}`
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="mt-5 w-full py-3 rounded-xl bg-white text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {portalLoading ? "Abrindo…" : "Gerenciar Assinatura"}
            </button>
            {portalError && <p className="text-red-400 text-xs mt-2">{portalError}</p>}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-3">
              Faturas
            </div>
            {loading && !data ? (
              <div className="text-white/40 text-sm">Carregando…</div>
            ) : data?.invoices && data.invoices.length > 0 ? (
              <ul className="divide-y divide-white/[0.06]">
                {data.invoices.map((inv, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <span className="text-white/70">{fmtDate(inv.date)}</span>
                    <span className="flex items-center gap-3">
                      <span>{fmtMoney(inv.amount, inv.currency)}</span>
                      {inv.url && (
                        <a
                          href={inv.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/50 hover:text-white inline-flex items-center gap-1"
                        >
                          ver <ExternalLink size={12} />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-white/40 text-sm">Nenhuma fatura ainda.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
