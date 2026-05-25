-- Fix search_path on SECURITY DEFINER + helper functions
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()  SET search_path = public, pg_temp;

-- Revoke RPC execute (triggers don't need direct RPC access)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Narrow storage listing: only owner lists own files; public still reads via direct URL
DROP POLICY IF EXISTS "idea_photos_public_read" ON storage.objects;

CREATE POLICY "idea_photos_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'idea-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
