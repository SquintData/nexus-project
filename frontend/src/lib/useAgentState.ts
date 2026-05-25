import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { SphereState } from "@/components/Sphere";

const VALID: SphereState[] = ["idle", "listening", "processing", "error"];

export function useAgentState(): SphereState {
  const { user } = useAuth();
  const [state, setState] = useState<SphereState>("idle");

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`agent-status:${user.id}`)
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (VALID.includes(payload.state)) setState(payload.state);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return state;
}
