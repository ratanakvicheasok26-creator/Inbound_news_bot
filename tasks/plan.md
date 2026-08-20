# Implementation Plan: Supabase + Resend Auth & Password Reset Redesign

## Overview
Fix account creation and password reset delivery in Inbound Reports. Currently, password reset and email verification fail to deliver emails because the app relies on default Supabase email delivery without Resend integration. Furthermore, the reset password flow flashes an invalid link error on page load and lacks support for direct token links, and unconfirmed users get stuck in an "account already exists" loop. We will integrate Resend for branded transactional email delivery, modernize the forgot/reset password pages, handle unconfirmed users gracefully, and ensure end-to-end reliability.

## Architecture Decisions
1. **Server-Side Resend Integration (`src/lib/email.ts`)**: Use the Resend SDK on the server with clean HTML templates matching Inbound Reports branding. Fall back gracefully to development logging if `RESEND_API_KEY` is not yet set.
2. **Supabase Admin Link Generation (`generateLink`)**: Use `supabaseAdmin.auth.admin.generateLink({ type: 'recovery' | 'signup', ... })` in API route handlers. This generates cryptographically signed recovery/verification links without hitting Supabase's default rate-limited mailer, letting Resend deliver them directly.
3. **Resilient Token & Session Recovery**: Support PKCE codes (`?code=...`), token hashes (`?token_hash=...`), hash fragments (`#access_token=...`), and existing sessions on `/reset-password`, with a proper loading skeleton to eliminate the instant error flash.
4. **Graceful Handling of Unconfirmed Accounts**: When an unconfirmed user attempts to sign up again or log in, allow re-sending verification emails rather than dead-ending with "Account already exists" or "Email not confirmed".

## Task List

### Phase 1: Foundation & Email Service
- [ ] Task 1: Install `resend` package and build `src/lib/email.ts` with branded HTML email templates for password reset and email verification.
- [ ] Task 2: Update `.env.example` with `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

### Checkpoint: Foundation
- [ ] Verify `resend` installs cleanly and `src/lib/email.ts` exports typed helper functions.

### Phase 2: API Endpoints & Auth Handlers
- [ ] Task 3: Update `/api/auth/forgot-password` to generate recovery links via `supabaseAdmin` and dispatch via Resend.
- [ ] Task 4: Update `/api/auth/signup` and create `/api/auth/resend-verification` to handle unconfirmed accounts and send branded verification emails via Resend.
- [ ] Task 5: Update `/api/auth/reset-password` and `src/lib/auth.ts` to bridge client actions with the server-side Resend and Supabase flows.

### Checkpoint: API & Backend
- [ ] Verify all API routes return proper JSON responses and handle edge cases (e.g., non-existent emails, invalid tokens, unconfirmed users).

### Phase 3: UI Redesign & Flow Polish
- [ ] Task 6: Redesign `/forgot-password` page with clear instructions, loading states, and reassuring confirmation feedback.
- [ ] Task 7: Redesign `/reset-password` page with loading skeleton, comprehensive token validation (query/hash/session), strength meter, show/hide toggles, and clear error recovery.
- [ ] Task 8: Update `/signup` and `/login` pages to offer one-click "Resend verification email" when unconfirmed accounts are detected.

### Checkpoint: Complete
- [ ] Build succeeds with `npm run build` in `inbound-news-web`.
- [ ] All flows (Signup -> Verification, Forgot Password -> Email -> Reset -> Login) verified end-to-end.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing `RESEND_API_KEY` in local dev | High | Provide fallback that logs action links directly to the terminal console so local testing is never blocked. |
| User arrives at `/reset-password` via hash fragment vs query param | Medium | Support both URLSearchParams and window.location.hash in the client-side session listener. |
| Email enumeration attack on forgot password | High | Always return generic success (`{ ok: true }`) regardless of whether the email exists in the database. |
