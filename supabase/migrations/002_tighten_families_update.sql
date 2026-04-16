-- Tighten families UPDATE policy to require the row belongs to the caller's family
DROP POLICY IF EXISTS "families_update" ON families;
CREATE POLICY "families_update" ON families FOR UPDATE
  USING (is_admin() AND id = get_my_family_id());
