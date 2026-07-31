-- Allow authenticated users to INSERT their own profile row.
-- 002 only granted SELECT + UPDATE; preference upsert from the web app needs INSERT
-- for users whose profile was not created by the auth trigger (or after trigger failure).

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Explicit UPDATE WITH CHECK so upserts that update existing rows remain scoped to self.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
