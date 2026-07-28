-- ============================================
-- Allow a document's file to be replaced in place (rotate / crop fixes)
-- ============================================
--
-- Photos of ID cards are routinely uploaded sideways or with half a desk in
-- frame. Until now the only remedy was deleting the document and re-uploading,
-- which loses the label, category, notes and creation date.
--
-- The storage bucket has no UPDATE policy, so the client cannot overwrite an
-- object at its existing path, and DELETE is admin-only — a member could not
-- clean up after replacing their own file. So the client uploads the corrected
-- image to a NEW path (INSERT is permitted within the family folder) and calls
-- this function to swap the pointer and reap the old blobs atomically.
--
-- Permission mirrors delete_document: admins, or the original uploader.

CREATE OR REPLACE FUNCTION replace_document_file(
  doc_id uuid,
  new_file_url text,
  new_file_size bigint
)
RETURNS json AS $$
DECLARE
  doc record;
  doc_family_id uuid;
  old_thumb_path text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT d.*, m.family_id AS fam_id
  INTO doc
  FROM documents d
  JOIN members m ON m.id = d.member_id
  WHERE d.id = doc_id;

  IF doc IS NULL THEN
    RETURN json_build_object('error', 'Document not found');
  END IF;

  doc_family_id := doc.fam_id;

  IF doc_family_id IS DISTINCT FROM get_my_family_id() THEN
    RETURN json_build_object('error', 'Forbidden');
  END IF;

  IF NOT (is_admin() OR doc.uploaded_by = auth.uid()) THEN
    RETURN json_build_object('error', 'Forbidden');
  END IF;

  -- The caller supplies the new path, so pin it inside this family's folder.
  -- Without this check a member could repoint a document at any object in the
  -- bucket, including another family's.
  IF split_part(new_file_url, '/', 1) IS DISTINCT FROM doc_family_id::text THEN
    RETURN json_build_object('error', 'Invalid file path');
  END IF;

  -- Nothing to swap; treat as a no-op rather than deleting the live file.
  IF new_file_url = doc.file_url THEN
    UPDATE documents SET file_size = new_file_size WHERE id = doc_id;
    RETURN json_build_object('success', true, 'file_url', new_file_url);
  END IF;

  old_thumb_path := regexp_replace(doc.file_url, '\.[^.]+$', '_thumb.jpg');

  -- Point the row at the corrected file first. The updated_at trigger fires
  -- here, which is what tells offline clients to re-download on next sync.
  UPDATE documents
  SET file_url = new_file_url,
      file_size = new_file_size
  WHERE id = doc_id;

  -- Then reap the superseded blobs.
  DELETE FROM storage.objects
    WHERE bucket_id = 'documents' AND name IN (doc.file_url, old_thumb_path);

  RETURN json_build_object('success', true, 'file_url', new_file_url);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
