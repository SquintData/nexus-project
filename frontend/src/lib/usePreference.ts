import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Read & write a per-user preference stored in `user_preferences` (key/value JSONB).
 *
 * Returns:
 *   value     — current preference (defaultValue until first load completes)
 *   setValue  — async setter that upserts to Supabase
 *   loaded    — true once the initial fetch finished
 */
export function usePreference<T>(
  key: string,
  defaultValue: T,
): {
  value: T;
  setValue: (next: T) => Promise<void>;
  loaded: boolean;
} {
  const [value, setLocal] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (cancelled) return;
      if (data?.value !== undefined && data.value !== null) {
        setLocal(data.value as T);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [key]);

  const setValue = useCallback(async (next: T) => {
    setLocal(next);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: u.user.id, key, value: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" },
      );
  }, [key]);

  return { value, setValue, loaded };
}
