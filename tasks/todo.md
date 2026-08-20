# Tasks: Supabase + Resend Auth & Password Reset Redesign

## Phase 1: Foundation & Email Service
- [ ] Task 1: Install `resend` package and build `src/lib/email.ts` with branded HTML email templates for password reset and email verification.
- [ ] Task 2: Update `.env.example` with `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

## Checkpoint: Foundation
- [ ] Verify `resend` installs cleanly and `src/lib/email.ts` exports typed helper functions.

## Phase 2: API Endpoints & Auth Handlers
- [ ] Task 3: Update `/api/auth/forgot-password` to generate recovery links via `supabaseAdmin` and dispatch via Resend.
- [ ] Task 4: Update `/api/auth/signup` and create `/api/auth/resend-verification` to handle unconfirmed accounts and send branded verification emails via Resend.
- [ ] Task 5: Update `/api/auth/reset-password` and `src/lib/auth.ts` to bridge client actions with the server-side Resend and Supabase flows.

## Checkpoint: API & Backend
- [ ] Verify all API routes return proper JSON responses and handle edge cases (e.g., non-existent emails, invalid tokens, unconfirmed users).

## Phase 3: UI Redesign & Flow Polish
- [ ] Task 6: Redesign `/forgot-password` page with clear instructions, loading states, and reassuring confirmation feedback.
- [ ] Task 7: Redesign `/reset-password` page with loading skeleton, comprehensive token validation (query/hash/session), strength meter, show/hide toggles, and clear error recovery.
- [ ] Task 8: Update `/signup` and `/login` pages to offer one-click "Resend verification email" when unconfirmed accounts are detected.

## Checkpoint: Complete
- [ ] Build succeeds with `npm run build` in `inbound-news-web`.
- [ ] All flows (Signup -> Verification, Forgot Password -> Email -> Reset -> Login) verified end-to-end.
