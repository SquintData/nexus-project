-- llm_usage: per-user / per-day / per-kind metering for the llm-proxy,
-- stt-proxy and tts-proxy Edge Functions (quota enforcement + analytics).
--
-- This table and its RPC were originally created ad-hoc against production via
-- MCP and never recorded in the repo. This migration is the canonical, replayable
-- definition so the structure survives a restore or a fresh Staging project.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.llm_usage (
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date    DATE    NOT NULL DEFAULT CURRENT_DATE,
  kind          TEXT    NOT NULL CHECK (kind IN ('chat', 'stt', 'tts')),
  calls         INTEGER NOT NULL DEFAULT 0,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date, kind)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Users may read ONLY their own usage. There is intentionally NO insert/update/
-- delete policy: under RLS that denies all writes to anon/authenticated even
-- though Supabase grants them broad table privileges by default. All writes go
-- through increment_llm_usage() below (SECURITY DEFINER, service_role only).
-- ---------------------------------------------------------------------------
ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS llm_usage_select_own ON public.llm_usage;
CREATE POLICY llm_usage_select_own
  ON public.llm_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPC: atomic upsert-increment of a usage row.
-- SECURITY DEFINER so the proxies can write metering rows past RLS.
-- search_path is pinned to prevent search_path hijacking of the SECURITY
-- DEFINER body, and the body fully-qualifies public.llm_usage.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_llm_usage(
  p_user_id UUID,
  p_date    DATE,
  p_kind    TEXT,
  p_input   INTEGER,
  p_output  INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.llm_usage (user_id, usage_date, kind, calls, input_tokens, output_tokens)
  VALUES (p_user_id, p_date, p_kind, 1, p_input, p_output)
  ON CONFLICT (user_id, usage_date, kind)
  DO UPDATE SET
    calls         = llm_usage.calls + 1,
    input_tokens  = llm_usage.input_tokens + p_input,
    output_tokens = llm_usage.output_tokens + p_output;
END;
$$;

-- ---------------------------------------------------------------------------
-- Function privilege hardening (deviation from current prod — see note).
-- The function is SECURITY DEFINER and trusts an arbitrary p_user_id, so any
-- role with EXECUTE can inflate ANY user's counters via the PostgREST RPC
-- endpoint (a quota-DoS vector). Production currently grants EXECUTE to
-- PUBLIC / anon / authenticated. Only the proxies call it, and they use
-- service_role, so EXECUTE is restricted to service_role.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.increment_llm_usage(UUID, DATE, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_llm_usage(UUID, DATE, TEXT, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_llm_usage(UUID, DATE, TEXT, INTEGER, INTEGER) TO service_role;
