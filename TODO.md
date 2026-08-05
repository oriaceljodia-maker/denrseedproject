# DENR Seed Inventory - Auth Login 500 Error Fix Tasks

## LIVE DB STATUS (verified via curl diagnostics)

| Check | Status | Meaning |
|-------|--------|---------|
| Auth health | ✅ 200 | Project online, NOT paused |
| Auth login test | ✅ 400 (invalid_credentials) | Auth works end-to-end |
| `profiles` table query | ✅ Returns data | Schema grants FIXED |
| `create_new_user_account` RPC | ✅ Exists ("Unauthorized" for anon) | Function working |
| `seeds` table | ❌ **Empty array** | Seed.sql NOT applied |
| Adding new user via Dashboard | ❌ Fails | Trigger broken/missing |
| Login 500 error | ✅ Fixed | Schema grants applied; server reachable |
| Login navigation | ✅ Fixed | Explicit navigate in login.page.js + removed SIGNED_IN race in main.js |

## ROOT CAUSE (verified)
The auth server is healthy and works correctly. The login 500 was caused by
the `42501 permission denied for schema public` error. The schema grants have
now been applied, but the **trigger + seed data** were either not applied or
failed.

The "failed to create/add" user error is likely because the `on_auth_user_created`
trigger on `auth.users` is broken or missing — it cannot auto-create a `profiles`
row when a new user is added, so the Dashboard creation fails.

## Next Action
Run `jodia/supabase/repair_trigger_and_seed.sql` in the Supabase SQL Editor.
This 6-part script:
1. Re-creates a **hardened** `handle_new_user()` trigger function with
   exception handling (won't block user creation)
2. Re-creates the `on_auth_user_created` trigger on `auth.users`
3. Re-grants privileges defensively
4. Re-inserts seed data into `seeds` (idempotent)
5. Verifies counts at the end
6. After this, adding users via Dashboard should work, and the app login
   should work (if the DB was the only issue).

## Completed Code Changes
- [x] `functions_and_triggers.sql`: on_auth_user_created trigger + real-auth-user RPC + idempotent policies/triggers + GRANT EXECUTE
- [x] `seed.sql`: only seeds data (removed fragile auth.users INSERT causing 42P10)
- [x] `admin_setup.sql`: promote Dashboard-created user to admin
- [x] `schema.sql`: CREATE TABLE definitions for profiles/seeds/requests + GRANT USAGE/ALL on public schema & tables to anon/authenticated (fixes "permission denied for schema public" 42501)
- [x] `login.page.js`: hardened error messaging
- [x] `user.service.js`: createPersonnelAccount passes user_password to RPC
- [x] `supabase.js`: map plain env var names (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) + window.ENV + fallbacks
- [x] `.env`: added VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY (Vite-compatible) + server-side vars
- [x] Build passes (`vite build`)

## Verified Supabase Project Status
- [x] Auth endpoint reachable (JWKS OK) — project is NOT paused
- [ ] `profiles` table query returns "permission denied for schema public" (42501) — confirms schema grants/tables missing; fixed in schema.sql
- [ ] Admin user must still be created via Dashboard (secret key blocked from browser use)
