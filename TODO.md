                                                                                                    # DENR Seed Inventory - Auth Login 500 Error Fix Tasks

## Goals
- [x] 1. Fix `functions_and_triggers.sql`: add `auth.users` insert trigger to auto-create `profiles` row (matching `NEW.id`)
- [x] 2. Rewrite `create_new_user_account` RPC to validate admin & pair with real auth flow (no random UUID)
- [x] 3. Update `seed.sql` to create a bootstrap admin through `supabase.auth.users` trigger path
- [x] 4. Harden `login.page.js` error handling for network/5xx errors (paused DB, server errors)
- [x] 5. Update `user.service.js` `createPersonnelAccount` to pair with real auth flow (auth user -> trigger creates profile)
- [x] 6. Run `vite build` to confirm no JS errors (build passes)

## Remaining Manual Steps (outside code)
- [ ] Re-run `functions_and_triggers.sql` then `seed.sql` in the Supabase SQL Editor
- [ ] Verify the Supabase project is NOT paused (restart/`docker start` if paused)
- [ ] Change the bootstrap admin password from the placeholder `Admin@12345`
- [ ] Grant `EXECUTE` on `create_new_user_account` to `authenticated` role if needed
