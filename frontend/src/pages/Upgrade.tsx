import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBillingPortal } from "@/lib/useBillingPortal";

type PlanKey = "chat" | "voice";
type Billing = "monthly" | "yearly";

const PLANS = [
  {
    key: "free" as const,
    name: "Free",
    monthlyPrice: null,
    yearlyPrice: null,
    description: "Organize tudo manualmente, sem precisar de IA.",
    features: [
      "Dashboard, Tarefas, Agenda, Ideias",
      "Hábitos, Diário, Finanças, Memória",
      "Sem IA — operação manual",
    ],
    cta: "Plano atual",
    highlighted: false,
  },
  {
    key: "chat" as const,
    name: "Nexus Chat",
    monthlyPrice: "R$39",
    yearlyPrice: "R$392",
    description: "IA completa via texto. Controle tudo por chat.",
    features: [
      "Tudo do Free",
      "Chat ilimitado com o assistente",
      "IA cria e edita Tarefas, Agenda, Ideias",
      "IA gerencia Hábitos, Diário, Finanças",
      "IA salva e recupera Memórias",
      "IA abre apps, URLs e playlists",
    ],
    cta: "Assinar Chat",
    highlighted: true,
  },
  {
    key: "voice" as const,
    name: "Nexus Voice",
    monthlyPrice: "R$99",
    yearlyPrice: "R$992",
    description: "Controle por voz. Diga \"Olá, Nexus\" e pronto.",
    features: [
      "Tudo do Nexus Chat",
      "Wake word \"Olá, Nexus\"",
      "Todos os comandos por voz",
      "Respostas em áudio natural (pt-BR)",
      "Acesso antecipado a novas features",
      "Suporte prioritário",
    ],
    cta: "Assinar Voice",
    highlighted: false,
  },
];

export default function Upgrade() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user, profile, session } = useAuth();
  const { openPortal, loading: portalLoading, error: portalError } = useBillingPortal();
  const [searchParams] = useSearchParams();
  const highlightedPlan = searchParams.get("plan") as PlanKey | null;
  const isSubscriber =
    !!profile && profile.plan_type !== "free" && !!profile.stripe_customer_id;

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLoading(null);
        setError(null);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  async function handleSubscribe(plan: PlanKey) {
    if (!user) {
      window.location.href = `/login?redirect=/upgrade?plan=${plan}`;
      return;
    }
    setLoading(plan);
    setError(null);

    const timeout = setTimeout(() => {
      setLoading(null);
      setError("Tempo esgotado. Tente novamente.");
    }, 20000);

    try {
      const jwt = session?.access_token;
      if (!jwt) throw new Error("Sessão expirada — faça login novamente.");

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-checkout`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ plan, billing }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? `Erro HTTP ${res.status}`);
      if (!payload?.url) throw new Error("URL de checkout não retornada");

      clearTimeout(timeout);
      // Reset loading before navigating so bfcache captures clean state
      setLoading(null);
      window.location.href = payload.url;
    } catch (e: unknown) {
      clearTimeout(timeout);
      setError(e instanceof Error ? e.message : "Erro inesperado");
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <Link to={user ? "/app" : "/"} className="flex items-center gap-2">
          <img src="/nexus-logo.png" alt="Nexus" className="w-7 h-7 object-contain" />
          <span className="font-semibold tracking-tight">NEXUS</span>
        </Link>
        {user ? (
          <Link to="/app" className="text-sm text-white/50 hover:text-white">
            ← Voltar ao app
          </Link>
        ) : (
          <Link to="/login" className="text-sm text-white/50 hover:text-white">
            Entrar
          </Link>
        )}
      </header>

      <main className="flex-1 px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Escolha seu plano
          </h1>
          <p className="text-white/50 text-sm">
            {profile?.plan_type !== "free"
              ? `Plano atual: ${profile?.plan_type === "chat" ? "Nexus Chat" : "Nexus Voice"}`
              : "Comece grátis, faça upgrade quando quiser."}
          </p>
        </div>

        {isSubscriber ? (
          <div className="max-w-md mx-auto flex flex-col items-center text-center rounded-2xl border border-white/20 bg-white/[0.03] shadow-[0_0_60px_rgba(255,255,255,0.04)] p-10 gap-5">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
              <CreditCard size={22} strokeWidth={1.6} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg mb-1">Você já é assinante</h2>
              <p className="text-white/50 text-sm">
                Gerencie sua assinatura, atualize a forma de pagamento, troque de
                plano ou cancele quando quiser.
              </p>
            </div>
            {portalError && <p className="text-red-400 text-sm">{portalError}</p>}
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-white text-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {portalLoading ? "Abrindo..." : "Gerenciar Assinatura"}
            </button>
          </div>
        ) : (
          <>
        <div className="flex justify-center mb-10">
          <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-lg p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                billing === "yearly"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Anual
              <span className="ml-1.5 text-[11px] text-emerald-400 font-semibold">-15%</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-center text-red-400 text-sm mb-6">{error}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = profile?.plan_type === plan.key;
            const isHighlighted = plan.highlighted || highlightedPlan === plan.key;
            const price =
              plan.key === "free"
                ? "Grátis"
                : billing === "monthly"
                ? plan.monthlyPrice + "/mês"
                : plan.yearlyPrice + "/ano";

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border p-8 gap-5 ${
                  isHighlighted
                    ? "border-white/20 bg-white/[0.03] shadow-[0_0_60px_rgba(255,255,255,0.04)]"
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                {isHighlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Mais Popular
                  </span>
                )}

                <div>
                  <h2 className="font-semibold text-lg mb-1">{plan.name}</h2>
                  <div className="text-3xl font-bold tracking-tight">{price}</div>
                  <p className="text-white/40 text-sm mt-1">{plan.description}</p>
                </div>

                <ul className="flex flex-col gap-2.5 border-t border-white/[0.06] pt-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                      <span className="text-white font-bold mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {plan.key === "free" ? (
                    <Link
                      to={user ? "/app" : "/login"}
                      className="block w-full text-center py-3 rounded-xl border border-white/[0.08] text-sm font-medium text-white/60 hover:text-white hover:border-white/20 transition-colors"
                    >
                      {isCurrent ? "Plano atual" : "Começar Grátis"}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.key as PlanKey)}
                      disabled={!!loading || isCurrent}
                      className={`w-full py-3 rounded-xl text-sm font-semibold transition-opacity ${
                        isHighlighted
                          ? "bg-white text-black hover:opacity-90"
                          : "border border-white/[0.08] text-white hover:border-white/20"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {loading === plan.key
                        ? "Redirecionando..."
                        : isCurrent
                        ? "Plano atual"
                        : plan.cta}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
