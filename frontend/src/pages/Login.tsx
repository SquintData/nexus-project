import { FormEvent, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth } from "@/lib/auth";

const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;

export default function Login() {
  const { user, signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const captchaRequired = !!TURNSTILE_SITEKEY;
  const submitDisabled = busy || (captchaRequired && !captchaToken);

  function friendlyError(raw: string): string {
    if (raw.includes("captcha") || raw.includes("timeout-or-duplicate"))
      return "Falha na verificação. Recarregue a página e tente novamente.";
    if (raw.includes("rate limit") || raw.includes("429"))
      return "Muitas tentativas. Aguarde alguns minutos.";
    if (raw.includes("already registered"))
      return "Este email já possui uma conta. Tente fazer login.";
    if (raw.includes("Invalid login credentials"))
      return "Email ou senha incorretos.";
    if (raw.includes("Email not confirmed"))
      return "Email não confirmado. Verifique sua caixa de entrada.";
    if (raw.includes("Password should be at least"))
      return "A senha deve ter pelo menos 6 caracteres.";
    return raw;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const result =
      mode === "signin"
        ? await signIn(email, password, captchaToken ?? undefined)
        : await signUp(email, password, captchaToken ?? undefined);
    if (result.error) {
      setErr(friendlyError(result.error));
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } else {
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      if (mode === "signup") setSignedUp(true);
    }
    setBusy(false);
  }

  function toggleMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setErr(null);
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }

  if (signedUp) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="glass w-full max-w-sm p-6 space-y-4 text-center">
          <div className="text-2xl font-bold">
            <span className="text-nexus-accent">Ne</span>xus
          </div>
          <p className="text-white/80 font-medium">Conta criada!</p>
          <p className="text-sm text-white/60">
            Verifique seu email e clique no link de confirmação antes de fazer login.
          </p>
          <p className="text-xs text-white/40">
            Não encontrou? Confira a pasta de spam ou lixo eletrônico.
          </p>
          <button
            type="button"
            onClick={() => { setSignedUp(false); setMode("signin"); }}
            className="btn btn-primary w-full"
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="glass w-full max-w-sm p-6 space-y-4">
        <div className="text-2xl font-bold">
          <span className="text-nexus-accent">Ne</span>xus
        </div>
        <p className="text-sm text-white/60">
          {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
        </p>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label">Senha</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>
        {captchaRequired && (
          <div className="w-full">
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITEKEY!}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
              options={{
                theme: "dark",
                size: "flexible",
                refreshExpired: "auto",
                refreshTimeout: "auto",
              }}
            />
          </div>
        )}
        {err && <div className="text-sm text-nexus-error">{err}</div>}
        <button className="btn btn-primary w-full" disabled={submitDisabled}>
          {busy
            ? "..."
            : captchaRequired && !captchaToken
            ? "Aguardando verificação..."
            : mode === "signin"
            ? "Entrar"
            : "Criar conta"}
        </button>
        <button
          type="button"
          onClick={toggleMode}
          className="text-xs text-white/50 hover:text-white/80 w-full text-center"
        >
          {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </form>
    </div>
  );
}
