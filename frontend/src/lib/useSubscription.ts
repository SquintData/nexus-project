import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export interface InvoiceLine {
  date: string | null;
  amount: number;
  currency: string | null;
  status: string | null;
  url: string | null;
}

export interface SubscriptionInfo {
  subscribed: boolean;
  plan_type: string;
  status?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  amount?: number | null;
  currency?: string | null;
  interval?: string | null;
  card?: { brand: string; last4: string } | null;
  invoices?: InvoiceLine[];
}

// Simple module-level cache so navigating to /app/conta repeatedly does NOT
// hit the Edge Function every mount. refetch(force) bypasses it (used by the
// "Tentar novamente" button and after the user returns from the Stripe portal).
const TTL_MS = 5 * 60 * 1000;
let cache: { data: SubscriptionInfo; ts: number } | null = null;

export function useSubscription() {
  const [data, setData] = useState<SubscriptionInfo | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (force: boolean) => {
    if (!force && cache && Date.now() - cache.ts < TTL_MS) {
      setData(cache.data);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke(
        "stripe-subscription",
        { method: "POST" },
      );
      if (err) throw err;
      cache = { data: res as SubscriptionInfo, ts: Date.now() };
      if (mounted.current) setData(res as SubscriptionInfo);
    } catch (e: unknown) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Erro ao carregar assinatura");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load(false);
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return { data, loading, error, refetch: () => load(true) };
}
