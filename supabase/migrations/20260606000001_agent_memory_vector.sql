-- Long-term agent memory (RAG). Hybrid explicit/implicit model.
-- Embeddings: OpenAI text-embedding-3-small (1536 dims).

-- 1. pgvector in the dedicated 'extensions' schema (Supabase best practice;
--    avoids the "extension in public" advisor).
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.memories (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT         NOT NULL,
  embedding   vector(1536),                 -- nullable: batch pipeline may embed after insert
  is_explicit BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 3. Indexes: HNSW cosine (works on an empty/growing table, unlike IVFFlat which
--    needs data to build lists) + btree on user_id for the per-user filter / RLS.
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw_idx
  ON public.memories USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS memories_user_id_idx
  ON public.memories (user_id);

-- 4. RLS — owner-only for every operation.
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memories_select_own ON public.memories;
CREATE POLICY memories_select_own ON public.memories
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS memories_insert_own ON public.memories;
CREATE POLICY memories_insert_own ON public.memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS memories_update_own ON public.memories;
CREATE POLICY memories_update_own ON public.memories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS memories_delete_own ON public.memories;
CREATE POLICY memories_delete_own ON public.memories
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Similarity-search RPC.
--    SECURITY DEFINER + pinned search_path. It trusts p_user_id and bypasses
--    RLS, so EXECUTE is restricted to service_role (below): no untrusted role
--    may call it with someone else's id. The proxies authenticate the user and
--    call this with the verified user_id.
CREATE OR REPLACE FUNCTION public.match_memories(
  p_user_id         UUID,
  p_query_embedding vector(1536),
  match_threshold   FLOAT,
  match_count       INT
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    m.id,
    m.content,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM public.memories m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> p_query_embedding) >= match_threshold
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT LEAST(match_count, 200);
$$;

-- 6. Lock down EXECUTE: only the proxies (service_role) may call it.
REVOKE ALL ON FUNCTION public.match_memories(UUID, vector, FLOAT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_memories(UUID, vector, FLOAT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_memories(UUID, vector, FLOAT, INT) TO service_role;
