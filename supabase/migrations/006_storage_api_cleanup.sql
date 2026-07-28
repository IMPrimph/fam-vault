-- ============================================
-- Move blob cleanup off direct storage.objects DML
-- ============================================
--
-- Supabase now rejects direct DML against storage.objects:
--   "Direct deletion from storage tables is not allowed. Use the Storage API
--    instead."
-- Deleting the row there never freed the underlying S3 bytes anyway, so the
-- old approach was leaking storage even when it appeared to work.
--
-- This breaks delete_document (shipped in 004) and replace_document_file
-- (005). Both are rewritten to do only what a SECURITY DEFINER function
-- should: authorize the caller and mutate the documents table. They now
-- return the orphaned object paths, and the client removes them through the
-- Storage API — the only supported route.

-- ---------------------------------------------
-- delete_document: authorize + delete the row, report blobs to reap
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION delete_document(doc_id uuid)
RETURNS json AS $$
DECLARE
  doc record;
  thumb_path text;
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

  IF doc.fam_id IS DISTINCT FROM get_my_family_id() THEN
    RETURN json_build_object('error', 'Forbidden');
  END IF;

  IF NOT (is_admin() OR doc.uploaded_by = auth.uid()) THEN
    RETURN json_build_object('error', 'Forbidden');
  END IF;

  thumb_path := regexp_replace(doc.file_url, '\.[^.]+$', '_thumb.jpg');

  DELETE FROM documents WHERE id = doc_id;

  RETURN json_build_object(
    'success', true,
    'paths', json_build_array(doc.file_url, thumb_path)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------
-- replace_document_file: swap the pointer, report the superseded blobs
-- ---------------------------------------------
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

  -- Pin the caller-supplied path inside this family's folder, so a member
  -- can't repoint a document at an arbitrary object in the bucket.
  IF split_part(new_file_url, '/', 1) IS DISTINCT FROM doc_family_id::text THEN
    RETURN json_build_object('error', 'Invalid file path');
  END IF;

  IF new_file_url = doc.file_url THEN
    UPDATE documents SET file_size = new_file_size WHERE id = doc_id;
    RETURN json_build_object('success', true, 'paths', json_build_array());
  END IF;

  old_thumb_path := regexp_replace(doc.file_url, '\.[^.]+$', '_thumb.jpg');

  -- The updated_at trigger fires here, which is what tells offline clients to
  -- re-download the corrected image on their next sync.
  UPDATE documents
  SET file_url = new_file_url,
      file_size = new_file_size
  WHERE id = doc_id;

  RETURN json_build_object(
    'success', true,
    'paths', json_build_array(doc.file_url, old_thumb_path)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------
-- Storage DELETE policy
-- ---------------------------------------------
-- Cleanup now happens client-side under the caller's own credentials, so the
-- previous admin-only DELETE policy would strand a member's superseded blobs
-- every time they fixed or removed their own upload.
--
-- This mirrors the INSERT policy from 004 (H8): admins anywhere inside the
-- family folder, everyone else only inside their own member folder.
--
-- Trade-off worth knowing: a member can now delete objects under their own
-- member folder directly, including one an admin uploaded on their behalf.
-- They cannot delete that document's row (documents_delete still requires
-- admin or uploader), so the worst case is a row whose file is missing —
-- recoverable by re-uploading, and no wider than what they can already read.

DROP POLICY IF EXISTS "Admins can delete family files" ON storage.objects;
DROP POLICY IF EXISTS "Family members can delete in own family path" ON storage.objects;

CREATE POLICY "Family members can delete in own family path"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT get_my_family_id()::text)
  AND (
    (SELECT is_admin())
    OR (storage.foldername(name))[2] = (SELECT id::text FROM members WHERE user_id = auth.uid())
  )
);
