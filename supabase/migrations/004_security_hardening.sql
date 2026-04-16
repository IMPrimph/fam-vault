-- ============================================
-- Security hardening pass
-- Addresses review findings C3, C4, H1, H2, H6, H8
-- ============================================

-- ---------------------------------------------
-- C4: Invites — default TTL + email binding in accept_invite
-- ---------------------------------------------

-- Default 7-day TTL for invites; backfill existing rows with a nearby expiry
ALTER TABLE invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

UPDATE invites
SET expires_at = now() + interval '7 days'
WHERE expires_at IS NULL AND status = 'pending';

-- Expose the bound email on lookup so the invite page can prefill / lock the
-- sign-in form. The token itself already acts as a bearer credential, so
-- returning the email it's bound to doesn't change the effective exposure.
CREATE OR REPLACE FUNCTION lookup_invite(invite_token text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'family_name', f.name,
    'member_name', m.name,
    'relationship', m.relationship,
    'status', i.status,
    'expires_at', i.expires_at,
    'email', i.email
  ) INTO result
  FROM invites i
  JOIN members m ON m.id = i.member_id
  JOIN families f ON f.id = i.family_id
  WHERE i.token = invite_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Email binding: if the invite carries an email, only a user signed in with
-- that email may accept. Pending invites without email keep the old behavior.
CREATE OR REPLACE FUNCTION accept_invite(invite_token text)
RETURNS json AS $$
DECLARE
  inv record;
  caller_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'You must be signed in to accept an invite');
  END IF;

  SELECT * INTO inv FROM invites WHERE token = invite_token FOR UPDATE;
  IF inv IS NULL THEN
    RETURN json_build_object('error', 'Invite not found');
  END IF;

  IF inv.status != 'pending' THEN
    RETURN json_build_object('error', 'Invite is no longer valid');
  END IF;

  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    RETURN json_build_object('error', 'Invite has expired');
  END IF;

  IF inv.email IS NOT NULL THEN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    IF caller_email IS NULL OR lower(caller_email) != lower(inv.email) THEN
      RETURN json_build_object('error', 'This invite was issued to a different email address');
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'You are already a member of a family');
  END IF;

  IF EXISTS (SELECT 1 FROM members WHERE id = inv.member_id AND user_id IS NOT NULL) THEN
    RETURN json_build_object('error', 'This member slot has already been claimed');
  END IF;

  UPDATE members SET user_id = auth.uid() WHERE id = inv.member_id;
  UPDATE invites SET status = 'accepted' WHERE id = inv.id;
  UPDATE invites SET status = 'revoked'
    WHERE member_id = inv.member_id AND id != inv.id AND status = 'pending';

  RETURN json_build_object(
    'success', true,
    'family_id', inv.family_id,
    'member_id', inv.member_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------
-- H1: Constrain admin members UPDATE to safe columns
-- ---------------------------------------------
-- Revoke table-wide UPDATE from authenticated, re-grant only safe columns.
-- user_id, family_id, created_by, id are no longer mutable by any client — the
-- RLS policy still gates who can touch the row; grants gate which columns.

REVOKE UPDATE ON members FROM authenticated;
GRANT UPDATE (name, relationship, role, parent_member_id, spouse_member_id, avatar_url)
  ON members TO authenticated;

-- ---------------------------------------------
-- H6: Last-admin DELETE guard (trigger on DELETE)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION prevent_last_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (SELECT count(*) FROM members WHERE family_id = OLD.family_id AND role = 'admin' AND id != OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot delete the last admin from the family';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_last_admin_delete ON members;
CREATE TRIGGER check_last_admin_delete
  BEFORE DELETE ON members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_admin_delete();

-- ---------------------------------------------
-- H2: Atomic document delete RPC
-- Non-admin uploaders can delete their own uploads (DB row + blobs) via this
-- SECURITY DEFINER function; admins can delete any family document.
-- Client is expected to route deletes through this RPC.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION delete_document(doc_id uuid)
RETURNS json AS $$
DECLARE
  doc record;
  doc_family_id uuid;
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

  doc_family_id := doc.fam_id;

  IF doc_family_id IS DISTINCT FROM get_my_family_id() THEN
    RETURN json_build_object('error', 'Forbidden');
  END IF;

  IF NOT (is_admin() OR doc.uploaded_by = auth.uid()) THEN
    RETURN json_build_object('error', 'Forbidden');
  END IF;

  thumb_path := regexp_replace(doc.file_url, '\.[^.]+$', '_thumb.jpg');

  DELETE FROM storage.objects
    WHERE bucket_id = 'documents' AND name IN (doc.file_url, thumb_path);

  DELETE FROM documents WHERE id = doc_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------
-- Storage policy reminders (run manually in Supabase SQL editor)
-- These live outside normal migrations because storage.objects is managed
-- by Supabase's storage extension.
-- ---------------------------------------------
--
-- -- H8: scope INSERT to the caller's own member folder (admins keep full scope)
-- DROP POLICY IF EXISTS "Family members can upload to own family path" ON storage.objects;
-- CREATE POLICY "Family members can upload to own family path"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'documents'
--   AND (storage.foldername(name))[1] = (SELECT get_my_family_id()::text)
--   AND (
--     (SELECT is_admin())
--     OR (storage.foldername(name))[2] = (SELECT id::text FROM members WHERE user_id = auth.uid())
--   )
-- );
--
-- -- C3: scope DELETE to the caller's family folder (admins only; non-admin
-- -- deletes go through the delete_document RPC defined above)
-- DROP POLICY IF EXISTS "Admins can delete family files" ON storage.objects;
-- CREATE POLICY "Admins can delete family files"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'documents'
--   AND (storage.foldername(name))[1] = (SELECT get_my_family_id()::text)
--   AND (SELECT is_admin())
-- );
