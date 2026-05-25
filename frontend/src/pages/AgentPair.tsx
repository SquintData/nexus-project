import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// Unambiguous alphabet (no 0/O/1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 8): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[arr[i] % ALPHABET.length];
  return out;
}

interface PairingCode {
  code: string;
  expires_at: string;
  consumed_at: string | null;
}

type Tab = "pair" | "howto";

function PairTab() {
  const { user } = useAuth();
  const [active, setActive] = useState<PairingCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("agent_pairing_codes")
        .select("code, expires_at, consumed_at")
        .eq("user_id", user.id)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setActive(data);
    })();
  }, [user]);

  useEffect(() => {
    if (!active) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const ms = new Date(active.expires_at).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    // Only depends on secondsLeft — if active were here, this would fire
    // immediately after setActive(data) while secondsLeft is still 0.
    if (secondsLeft === 0 && active) setActive(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  async function generate() {
    setBusy(true);
    setErr(null);
    if (!user) {
      setErr("Sessão não encontrada. Recarregue a página.");
      setBusy(false);
      return;
    }
    try {
      const code = randomCode(8);
      const { data, error } = await supabase
        .from("agent_pairing_codes")
        .insert({ code, user_id: user.id })
        .select("code, expires_at, consumed_at")
        .single();
      if (error) {
        setErr(error.message || error.code || "Erro ao gerar código");
      } else if (data) {
        setActive(data);
      } else {
        setErr("Resposta inesperada do servidor");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!active) return;
    await supabase.from("agent_pairing_codes").delete().eq("code", active.code);
    setActive(null);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/60">
        Gere um código aqui e cole no instalador do agente quando ele pedir.
        O código expira em 10 minutos e só pode ser usado uma vez.
      </p>

      {active ? (
        <div className="glass p-6 space-y-4">
          <div className="text-xs uppercase text-white/50">Código ativo</div>
          <div className="text-4xl font-mono tracking-[0.3em] text-nexus-accent">
            {active.code}
          </div>
          <div className="text-sm text-white/60">
            Expira em {mins}:{secs.toString().padStart(2, "0")}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => navigator.clipboard.writeText(active.code)}
            >
              Copiar
            </button>
            <button className="btn btn-ghost" onClick={cancel}>
              Cancelar
            </button>
          </div>
          <div className="text-xs text-white/40 pt-2 border-t border-white/10">
            No terminal onde o agente está instalado, rode:
            <pre className="mt-2 bg-black/40 p-3 rounded text-white/70 overflow-x-auto">
              python -m agent.main
            </pre>
            Quando pedir o código de pareamento, cole o valor acima.
          </div>
        </div>
      ) : (
        <div className="glass p-6 space-y-4">
          <p className="text-sm text-white/60">
            Nenhum código ativo. Clique abaixo pra gerar um novo.
          </p>
          <button className="btn btn-primary" onClick={generate} disabled={busy}>
            {busy ? "Gerando..." : "Gerar código"}
          </button>
          {err && (
            <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {err}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-nexus-accent/20 border border-nexus-accent/40 flex items-center justify-center text-sm font-bold text-nexus-accent">
        {n}
      </div>
      <div className="space-y-1 pt-1">
        <div className="font-semibold text-white">{title}</div>
        <div className="text-sm text-white/60 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function HowToTab({ onGoToPair }: { onGoToPair: () => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-white/60">
        Siga os passos abaixo para instalar e ligar o agente Nexus no seu computador.
        Não precisa de experiência com programação.
      </p>

      <div className="glass p-6 space-y-6">
        <Step n={1} title="Instale o Python">
          Acesse{" "}
          <a
            href="https://www.python.org/downloads/"
            target="_blank"
            rel="noreferrer"
            className="text-nexus-accent underline"
          >
            python.org/downloads
          </a>{" "}
          e baixe a versão mais recente para Windows. Durante a instalação,{" "}
          <strong className="text-white">
            marque a opção "Add Python to PATH"
          </strong>{" "}
          antes de clicar em Install — essa etapa é obrigatória.
        </Step>

        <Step n={2} title="Baixe o agente">
          Clique no botão abaixo para baixar o agente. Um arquivo ZIP vai aparecer
          na sua pasta de Downloads.
          <div className="mt-2">
            <a
              href="https://github.com/SquintData/nexus-agent/archive/refs/heads/master.zip"
              className="btn btn-secondary inline-block text-sm"
            >
              Baixar Nexus Agent
            </a>
          </div>
        </Step>

        <Step n={3} title="Extraia o ZIP">
          Clique com o botão direito no arquivo baixado e escolha{" "}
          <strong className="text-white">"Extrair tudo"</strong>. Anote a pasta onde
          você extraiu — você vai precisar dela depois.
        </Step>

        <Step n={4} title="Rode o setup">
          Abra a pasta extraída e dê um{" "}
          <strong className="text-white">duplo clique em setup.bat</strong>. Uma
          janela preta vai abrir e instalar tudo automaticamente. Aguarde até
          aparecer a mensagem de conclusão e feche a janela.
        </Step>

        <Step n={5} title="Gere o código de pareamento">
          Volte aqui e clique em{" "}
          <button
            onClick={onGoToPair}
            className="text-nexus-accent underline cursor-pointer"
          >
            Parear agente
          </button>{" "}
          para gerar um código de 8 letras. Deixe essa aba aberta — você vai
          precisar do código no próximo passo.
        </Step>

        <Step n={6} title="Ligue o agente">
          Na pasta do agente, dê um{" "}
          <strong className="text-white">duplo clique em run.bat</strong>. A janela
          vai pedir o código de pareamento — cole o código que você gerou no passo
          anterior e pressione Enter. Pronto! O agente vai se conectar à sua conta e
          começar a ouvir.
        </Step>

        <Step n={7} title="Diga 'Olá Nexus'">
          Com o agente rodando, diga{" "}
          <strong className="text-white">"Olá Nexus"</strong> perto do microfone e
          faça seu pedido. Você pode pedir para criar uma tarefa, marcar um evento,
          registrar uma ideia e muito mais.
        </Step>
      </div>

      <div className="glass p-4 space-y-2">
        <div className="text-sm font-semibold text-white">Problemas comuns</div>
        <div className="space-y-2 text-sm text-white/60">
          <div>
            <strong className="text-white/80">Python não encontrado</strong> —
            Reinstale o Python marcando "Add Python to PATH".
          </div>
          <div>
            <strong className="text-white/80">Microfone não detectado</strong> —
            Vá em Configurações → Som e defina seu microfone como dispositivo padrão.
          </div>
          <div>
            <strong className="text-white/80">Código expirou</strong> — Gere um
            novo código. Ele é válido por 10 minutos.
          </div>
          <div>
            <strong className="text-white/80">Agente não responde após um tempo</strong> —
            Repare o agente gerando um novo código (ele se desconecta depois de 30 dias sem uso).
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentPair() {
  const [tab, setTab] = useState<Tab>("pair");

  return (
    <div className="space-y-6 max-w-xl">
      <header>
        <h1 className="text-2xl font-bold">Agente local</h1>
      </header>

      <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
        {(
          [
            { id: "pair" as Tab, label: "Parear agente" },
            { id: "howto" as Tab, label: "Como usar" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === id
                ? "bg-nexus-accent text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pair" ? (
        <PairTab />
      ) : (
        <HowToTab onGoToPair={() => setTab("pair")} />
      )}
    </div>
  );
}
