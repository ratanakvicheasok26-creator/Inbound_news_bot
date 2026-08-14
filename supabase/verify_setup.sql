-- ============================================================
-- VERIFY the Inbound News Supabase setup.
-- This only CHECKS — it creates/changes/deletes nothing.
-- Run it: Supabase Dashboard -> SQL Editor -> New query -> paste
-- this whole file -> Run. Every row should say PASS.
-- ============================================================

SELECT '1. all 7 tables exist' AS check_name,
  CASE WHEN (
    SELECT count(*) FROM (
      SELECT unnest(ARRAY['articles','stories','story_sources','profiles','sponsors','memberships','payment_submissions'])::text AS t
    ) x
    LEFT JOIN information_schema.tables t
      ON t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name = x.t
    WHERE t.table_name IS NULL
  ) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
UNION ALL SELECT '2. payment_submissions has currency/proof/verified_by',
  CASE WHEN (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_submissions'
      AND column_name IN ('currency','payment_proof_url','verified_by')
  ) = 3 THEN 'PASS' ELSE 'FAIL' END
UNION ALL SELECT '3. memberships has expected columns',
  CASE WHEN (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='memberships'
      AND column_name IN ('plan','status','current_period_start','current_period_end','cancel_at_period_end')
  ) = 5 THEN 'PASS' ELSE 'FAIL' END
UNION ALL SELECT '4. RLS enabled on all 7 tables',
  CASE WHEN (
    SELECT count(*) FROM pg_tables
    WHERE schemaname='public'
      AND tablename IN ('articles','stories','story_sources','profiles','sponsors','memberships','payment_submissions')
      AND rowsecurity
  ) = 7 THEN 'PASS' ELSE 'FAIL' END
UNION ALL SELECT '5. payment_proofs bucket is private',
  CASE WHEN EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='payment_proofs' AND public = false
  ) THEN 'PASS' ELSE 'FAIL' END
UNION ALL SELECT '6. sponsor-creatives bucket is public',
  CASE WHEN EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='sponsor-creatives' AND public = true
  ) THEN 'PASS' ELSE 'FAIL' END
UNION ALL SELECT '7. sponsor storage policies',
  CASE WHEN (
    SELECT count(*) FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN ('Public read sponsor creatives','Service role manage sponsor creatives')
  ) = 2 THEN 'PASS' ELSE 'FAIL' END
UNION ALL SELECT '8. all 5 functions exist',
  CASE WHEN (
    SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('match_stories','is_active_member','handle_new_user','update_updated_at','increment_story_source_count')
  ) = 5 THEN 'PASS' ELSE 'FAIL' END;
