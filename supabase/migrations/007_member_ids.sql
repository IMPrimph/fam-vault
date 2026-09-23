-- ============================================
-- Copyable ID numbers, one per person + ID type
-- ============================================
--
-- The thing people actually do with a stored Aadhaar or PAN is copy its
-- number into a form. The number belongs to the person and the ID type, not
-- to a particular scan: an Aadhaar front and back share one number, and a
-- number can be known before any scan is uploaded. So it lives here, keyed
-- by (member, category), and documents stay exactly as they were — the files
-- for an ID are simply the documents with the same member + category.

CREATE TABLE member_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- Deleting a category deletes its numbers; the Settings UI warns first.
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  id_number text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (member_id, category_id)
);

CREATE INDEX member_ids_member_idx ON member_ids (member_id);

CREATE TRIGGER member_ids_updated_at
  BEFORE UPDATE ON member_ids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE member_ids ENABLE ROW LEVEL SECURITY;

-- Everyone in the family can see (and so copy) every number.
CREATE POLICY "member_ids_select" ON member_ids FOR SELECT USING (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
);

-- Writes mirror documents: admins for anyone, members for themselves. The
-- category must also belong to the caller's family, or a member could attach
-- a number to another family's category id.
CREATE POLICY "member_ids_insert" ON member_ids FOR INSERT WITH CHECK (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
  AND category_id IN (SELECT id FROM categories WHERE family_id = get_my_family_id())
  AND (is_admin() OR member_id = (SELECT id FROM members WHERE user_id = auth.uid()))
);

CREATE POLICY "member_ids_update" ON member_ids FOR UPDATE USING (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
  AND (is_admin() OR member_id = (SELECT id FROM members WHERE user_id = auth.uid()))
) WITH CHECK (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
  AND category_id IN (SELECT id FROM categories WHERE family_id = get_my_family_id())
  AND (is_admin() OR member_id = (SELECT id FROM members WHERE user_id = auth.uid()))
);

CREATE POLICY "member_ids_delete" ON member_ids FOR DELETE USING (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
  AND is_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON member_ids TO authenticated;
