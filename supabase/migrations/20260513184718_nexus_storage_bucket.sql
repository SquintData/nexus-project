-- Storage bucket for idea photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('idea-photos', 'idea-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users upload their own; public read
CREATE POLICY "idea_photos_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'idea-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "idea_photos_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'idea-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "idea_photos_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'idea-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "idea_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'idea-photos');
