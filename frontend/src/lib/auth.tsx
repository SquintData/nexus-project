import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  plan_type: "free" | "chat" | "voice";
  subscription_status: "active" | "inactive" | "past_due" | "canceled";
  stripe_customer_id: string | null;
  stripe_sub_id: string | null;
  plan_expires_at: string | null;
  created_at: string;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Resolve session + profile in one place. fetchProfile (supabase.from) is
    // NEVER awaited inside the onAuthStateChange callback: doing so re-enters
    // the supabase-js auth lock the callback already holds and deadlocks, which
    // also freezes getSession() and pins `loading` at true forever (the
    // infinite "Carregando…" on the route guards). The `finally` guarantees
    // loading always clears once the promise settles.
    async function resolve(s: Session | null) {
      if (!active) return;
      setSession(s);
      try {
        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          if (active) setProfile(p);
        } else if (active) {
          setProfile(null);
        }
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // INITIAL_SESSION is already handled by getSession() above. For every
      // other event, defer out of the callback so the auth lock is released
      // before fetchProfile runs — this is what prevents the deadlock.
      if (event === "INITIAL_SESSION") return;
      setTimeout(() => resolve(s), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
