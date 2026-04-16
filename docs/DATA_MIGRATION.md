# Data migration and cutover

This document tracks the legacy SQL → Supabase migration path described in the implementation plan.

## Preconditions

- Phase 1 schema is stable and applied to a **staging** Supabase project.
- Auth users use synthetic emails `[username]@playground.school.local` for kids/teachers; admin users remain separate accounts.

## Staging dry-run

1. Export legacy kid rows and related tables from the old database.
2. Map legacy `KidAccount.id` to new `kid_profiles.id` where possible (preserve stable UUIDs if they match `auth.users`).
3. Create **Auth users** via Supabase Admin API (service role) with hashed passwords (never import plaintext).
4. Insert profile rows and normalized social tables (`friendships`, `kid_blocks`) instead of array fields.
5. Validate **RLS** by running queries as test JWTs (kid / teacher / admin).
6. Run smoke tests: login, friends list, inbox, game session metadata insert.

## PublicKidProfile merge

Legacy `PublicKidProfile` is replaced by **`public_kid_profiles` view** (safe columns) and `kid_profiles` private fields under RLS. Merge public fields into `kid_profiles` during import; drop legacy public tables after verification.

## Password strategy

- Re-hash with Supabase-compatible hashing via Admin API **or** force password reset emails for legacy accounts.
- Never store or log plaintext passwords in migration scripts.

## Production cutover

- Maintenance window with backup / snapshot.
- Re-run import scripts against production with idempotent steps.
- Rollback: restore snapshot; keep Auth user list synchronized with documentation.

## Service role usage

- Bulk import and admin-only fixes use the **service role** on a secure runner (CI or operator workstation), never in the browser.
