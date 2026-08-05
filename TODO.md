# DENR Seed Inventory - Auth Login 500 Error Fix Tasks

## SQL Execution Order (run in Supabase SQL Editor)
1. [ ] **`schema.sql`** — creates `profiles`, `seeds`, `requests` tables (REQUIRED first — the trigger fails when tables don't exist, which blocks user creation)
2. [ ] **`functions_and_triggers.sql`** — functions, triggers, policies (idempotent)
3. [ ] **`seed.sql`** — seed data
4. [ ] **Create admin user via Dashboard** (Authentication → Users → Add user) — fires trigger to auto-create profile
5. [ ] **`admin_setup.sql`** — promote admin user to admin role

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
