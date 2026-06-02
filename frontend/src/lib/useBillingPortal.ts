import { useState } from "react";
import { supabase } from "./supabase";

// Opens the Stripe customer portal: pulls the current JWT, hits the
// `stripe-portal` Edge Function, and redirects to the returned URL.
// Mirrors the robustness of Upgrade's handleSubscribe (20s timeout, loading
// reset before navigation so bfcache captures clean state).
export function useBillingPortal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);

    const timeout = setTimeout(() => {
      setLoading(false);
      setError("Tempo esgotado. Tente novamente.");
    }, 20000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) throw new Error("Sessão expirada — faça login novamente.");

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? `Erro HTTP ${res.status}`);
      if (!payload?.url) throw new Error("URL do portal não retornada");

      clearTimeout(timeout);
      setLoading(false);
      window.location.href = payload.url;
    } catch (e: unknown) {
      clearTimeout(timeout);
      setError(e instanceof Error ? e.message : "Erro inesperado");
      setLoading(false);
    }
  }

  return { openPortal, loading, error };
}
