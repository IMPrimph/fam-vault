-- ============================================
-- Fam Vault: Initial Schema
-- ============================================

-- === updated_at trigger function ===
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- === families ===
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === members ===
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  relationship text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  parent_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  spouse_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  avatar_url text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Partial unique index: one user_id per family (nulls excluded)
CREATE UNIQUE INDEX members_user_id_unique ON members (user_id) WHERE user_id IS NOT NULL;

-- Prevent removing the last admin from a family
CREATE OR REPLACE FUNCTION prevent_last_admin_removal()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
    IF (SELECT count(*) FROM members WHERE family_id = OLD.family_id AND role = 'admin' AND id != OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last admin from the family';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_last_admin
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_admin_removal();

-- === categories ===
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- === documents ===
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  label text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === invites ===
CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- RLS Helper Functions
-- ============================================

CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS uuid AS $$
  SELECT family_id FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM members WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- --- families ---
CREATE POLICY "families_select" ON families FOR SELECT USING (id = get_my_family_id());
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "families_update" ON families FOR UPDATE USING (is_admin());

-- --- members ---
CREATE POLICY "members_select" ON members FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "members_insert" ON members FOR INSERT WITH CHECK (
  is_admin() AND family_id = get_my_family_id()
);
-- Only admins can update members directly. Non-admin self-edits go through update_my_profile RPC.
CREATE POLICY "members_update" ON members FOR UPDATE USING (
  is_admin() AND family_id = get_my_family_id()
);
CREATE POLICY "members_delete" ON members FOR DELETE USING (
  is_admin() AND family_id = get_my_family_id()
);

-- --- categories ---
CREATE POLICY "categories_select" ON categories FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (
  is_admin() AND family_id = get_my_family_id()
);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (
  is_admin() AND family_id = get_my_family_id()
);

-- --- documents ---
CREATE POLICY "documents_select" ON documents FOR SELECT USING (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
);
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
  AND (is_admin() OR member_id = (SELECT id FROM members WHERE user_id = auth.uid()))
);
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
  AND (is_admin() OR uploaded_by = auth.uid())
);
CREATE POLICY "documents_delete" ON documents FOR DELETE USING (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
  AND (is_admin() OR uploaded_by = auth.uid())
);

-- --- invites ---
CREATE POLICY "invites_select" ON invites FOR SELECT USING (
  is_admin() AND family_id = get_my_family_id()
);
CREATE POLICY "invites_insert" ON invites FOR INSERT WITH CHECK (
  is_admin() AND family_id = get_my_family_id()
);
CREATE POLICY "invites_update" ON invites FOR UPDATE USING (
  is_admin() AND family_id = get_my_family_id()
);

-- ============================================
-- RPC Functions (SECURITY DEFINER — bypass RLS)
-- ============================================

-- Lookup invite by token (public-facing, returns minimal info)
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
    'expires_at', i.expires_at
  ) INTO result
  FROM invites i
  JOIN members m ON m.id = i.member_id
  JOIN families f ON f.id = i.family_id
  WHERE i.token = invite_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept invite: links user_id to member, flips invite status
CREATE OR REPLACE FUNCTION accept_invite(invite_token text)
RETURNS json AS $$
DECLARE
  inv record;
  result json;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'You must be signed in to accept an invite');
  END IF;

  -- Fetch and lock the invite
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

  -- Check user isn't already linked to a member
  IF EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'You are already a member of a family');
  END IF;

  -- Check this member slot isn't already claimed by someone else
  IF EXISTS (SELECT 1 FROM members WHERE id = inv.member_id AND user_id IS NOT NULL) THEN
    RETURN json_build_object('error', 'This member slot has already been claimed');
  END IF;

  -- Link the user to the member
  UPDATE members SET user_id = auth.uid() WHERE id = inv.member_id;

  -- Mark invite as accepted
  UPDATE invites SET status = 'accepted' WHERE id = inv.id;

  -- Revoke any other pending invites for this same member
  UPDATE invites SET status = 'revoked'
  WHERE member_id = inv.member_id AND id != inv.id AND status = 'pending';

  SELECT json_build_object(
    'success', true,
    'family_id', inv.family_id,
    'member_id', inv.member_id
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create family + admin member in one atomic operation (post-signup)
CREATE OR REPLACE FUNCTION create_family_with_admin(family_name text, admin_name text)
RETURNS json AS $$
DECLARE
  new_family_id uuid;
  new_member_id uuid;
  default_categories text[] := ARRAY['Aadhaar', 'PAN Card', 'Driving License', 'Passport', 'Voter ID'];
  cat text;
BEGIN
  -- Check user doesn't already belong to a family
  IF EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'You already belong to a family');
  END IF;

  -- Create family
  INSERT INTO families (name, created_by)
  VALUES (family_name, auth.uid())
  RETURNING id INTO new_family_id;

  -- Create admin member
  INSERT INTO members (family_id, user_id, name, relationship, role, created_by)
  VALUES (new_family_id, auth.uid(), admin_name, 'Self', 'admin', auth.uid())
  RETURNING id INTO new_member_id;

  -- Seed default categories
  FOREACH cat IN ARRAY default_categories LOOP
    INSERT INTO categories (family_id, name) VALUES (new_family_id, cat);
  END LOOP;

  RETURN json_build_object(
    'family_id', new_family_id,
    'member_id', new_member_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe self-update: members can only change their own name and avatar_url
CREATE OR REPLACE FUNCTION update_my_profile(new_name text, new_avatar_url text DEFAULT NULL)
RETURNS json AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  UPDATE members
  SET name = new_name,
      avatar_url = new_avatar_url
  WHERE user_id = auth.uid();

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Storage bucket setup (run manually in Supabase dashboard)
-- ============================================
-- 1. Create a private bucket named "documents" with fileSizeLimit: 5242880 (5MB)
-- 2. Add these storage policies via SQL Editor:
--
-- CREATE POLICY "Family members can read own family files"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'documents'
--   AND (storage.foldername(name))[1] = (SELECT get_my_family_id()::text)
-- );
--
-- CREATE POLICY "Family members can upload to own family path"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'documents'
--   AND (storage.foldername(name))[1] = (SELECT get_my_family_id()::text)
-- );
--
-- CREATE POLICY "Admins can delete family files"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'documents'
--   AND (SELECT is_admin())
-- );
