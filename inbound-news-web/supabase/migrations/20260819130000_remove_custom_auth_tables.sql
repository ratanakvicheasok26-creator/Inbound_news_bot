-- =============================================================================
-- Migration: Remove custom auth system tables (replaced by Supabase Auth)
-- Date: 2026-08-19
-- =============================================================================
-- This migration drops the custom auth tables that were used before the
-- migration to Supabase Auth. The application now uses Supabase Auth's
-- built-in session management, password hashing, and email confirmation.

-- Drop custom auth tables
DROP TABLE IF EXISTS public.auth_credentials CASCADE;
DROP TABLE IF EXISTS public.refresh_tokens CASCADE;
DROP TABLE IF EXISTS public.email_verification_tokens CASCADE;
DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;
DROP TABLE IF EXISTS public.email_change_nonces CASCADE;
DROP TABLE IF EXISTS public.login_attempts CASCADE;

-- Drop the update_at trigger function that was only used by auth_credentials
-- (the profiles table has its own copy via handle_updated_at)
-- Note: handle_updated_at is still used by profiles, so we keep it.

-- Verify profiles table still has correct RLS and trigger
-- (should already exist from 20260818000000_profiles_schema.sql)
-- The on_auth_user_created trigger on auth.users should still be active,
-- creating profiles automatically when Supabase Auth creates a new user.
