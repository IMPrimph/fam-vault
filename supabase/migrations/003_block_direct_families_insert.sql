-- Block direct INSERTs on families. The create_family_with_admin RPC uses
-- SECURITY DEFINER and bypasses RLS, so it still works. This prevents any
-- raw client INSERT from creating families outside the guarded flow.
DROP POLICY IF EXISTS "families_insert" ON families;
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (false);
