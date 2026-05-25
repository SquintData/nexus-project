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

export default function AgentPair() {
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
    <div className="space-y-6 max-w-xl">
      <header>
        <h1 className="text-2xl font-bold">Parear agente local</h1>
        <p className="text-sm text-white/60">
          Gere um código aqui e cole no instalador do agente Python pra autorizar
          o acesso. O código expira em 10 minutos e só pode ser usado uma vez.
        </p>
      </header>

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
