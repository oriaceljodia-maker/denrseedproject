# Google Authenticator setup for all accounts

This release requires TOTP for both administrators and personnel, including existing accounts. Temporary password account creation and emailed Forgot Password links remain available. TOTP codes come from Google Authenticator (or another compatible authenticator), not from SMTP or an email template.

## Deploy in this order

1. In the correct Supabase project, open Authentication > Multi-Factor and confirm TOTP enrollment and verification are enabled. Keep your Supabase dashboard owner access available for lost-device recovery.
2. Deploy this frontend through your normal Git/Netlify process. Once Netlify publishes it, open the production portal with an account you control. Sign in, scan the QR in Google Authenticator and verify a code. Existing sessions without verified MFA must enroll or verify when they load the new app.
3. Open `mandatory_totp.sql`, copy the entire file into a new Supabase SQL Editor query and run it in the same project. Run the whole transaction. This is a standalone script, not a replacement for your original schema. Do not rerun the old activation/TOTP rollback or full-setup scripts.
4. Complete the checks below. The frontend starts requiring MFA as soon as deployed, but database enforcement is complete only after the SQL succeeds. Keep the interval between these steps short.

No new redirect URL or email template is needed for `/verify-authenticator`; users reach it inside the site. Keep the existing `/force-password` redirect for reset emails.

## Repair for existing deployments with a profiles recursion error

If you see `infinite recursion detected in policy for relation "profiles"`,
run the whole `fix_profile_policy_recursion.sql` file in a new SQL Editor query.
It replaces the old self-referencing administrator UPDATE policy with the
existing protected admin helper. Accounts, passwords, MFA factors and inventory
are preserved. The updated `mandatory_totp.sql` also includes this correction
for future setups; existing deployments only need the small repair script.

The database policy affects account enable/disable, profile edits, and the
profile flag saved after first-login or recovery password changes. A commit
alone cannot repair policies already installed in Supabase. Apply the repair,
then publish the accompanying frontend improvements through Git/Netlify.

If a user already saw “Your password changed, but account setup could not be
completed”, Supabase Auth may already have accepted their new password. Have
them sign in with that new password, choose a different new password in Step 1,
and verify their existing authenticator to finish setup. Do not delete
and recreate the account or remove its authenticator to resolve this policy error.

## What users see

- Temporary-password account (admin or personnel): sign in with the temporary password, Step 1 choose/confirm a new password, Step 2 connect or verify Google Authenticator, Step 3 open the correct dashboard. No sign-out or second password login is required.
- Step 1 collects the password; it does not save it yet. Supabase requires an AAL2 session for password changes on accounts with MFA. After Step 2 succeeds, the app saves the chosen password through Supabase Auth and clears the profile's password-setup flag under the existing TOTP-protected policies. No MFA bypass or direct Auth-table password update is added.
- Old or new account without verified TOTP and without a required password change: email/password, QR/setup key, first valid code, then the portal.
- Account with verified TOTP: email/password, code from the connected app, then the portal.
- Already verified persisted session: refresh/navigation keeps the current MFA session. It does not ask for a code on every click. A fresh password sign-in requires a fresh TOTP challenge. There is no separate “trust this device” bypass.
- Password reset: the recovery link creates a recovery session. The same three steps collect a new password, connect/verify the authenticator, save the password, and open the dashboard. A reset email does not remove MFA.
- Setup interrupted by reload before the password is saved: the in-memory password is discarded and the user returns to Step 1. It is never written to localStorage/sessionStorage, URLs or logs. After continuing, any unfinished factor is replaced with a new QR; remove the unfinished app entry if necessary. Verified factors are never deleted by setup.
- A password accepted by Supabase but followed by a failed profile update shows Continue setup. Retrying finalizes the profile without submitting the same password again. If signing out instead, use the new password next time. Back to Step 1 allows choosing a different password when Supabase rejects it.
- Maintenance mode: authentication remains usable; the personnel maintenance screen appears only after MFA and required password setup.

The setup key is equivalent to the authenticator secret. It stays in memory only and is displayed for initial connection. Never email it, add it to SQL, publish it, or share screenshots containing it. After setup, only code verification is shown.

## Remember me and temporary-password visibility

The Create Account modal now includes an eye button to show or hide the temporary password. It starts hidden whenever the modal is opened, and showing it does not submit or save the account.

The login form has an unchecked “Remember me on this device” option above Sign In. This remembers a Supabase session, not the password, TOTP secret, QR code or last verification code. Browser password-manager support uses the native username/current-password autocomplete fields; the app does not implement password storage.

- Checked: the native session is persisted in this browser. The first password sign-in still requires authenticator setup/verification and any mandatory password setup. Returning to the site can use an existing valid AAL2 session without another code.
- Unchecked: the native session uses sessionStorage for this tab, or memory if browser storage is blocked. Refresh works while the tab session exists. Browsers can restore tabs/sessionStorage, so always sign out on shared computers rather than relying on closing a window.
- Explicit sign-out removes the saved session and preference. A fresh password sign-in, another browser/device, cleared site storage or an expired/revoked session requires authentication again. A checkbox never sets mfaVerified and does not change the database's AAL2 requirement.
- When first upgrading, an old localStorage session without a remember preference is moved into the current tab; the app does not silently opt existing users into Remember me.
- Remember me is not a promise of a fixed number of days. Supabase session limits, refresh-token validity and account/factor status still apply. If persistent storage is blocked, the login form asks the user to uncheck Remember me.

No SQL, email-template or Supabase dashboard change is required for these two features. Do not run a TOTP rollback or loosen policies to implement Remember me. Deploy the frontend normally, then check both checkbox states, sign-out, browser restart, first-time setup and an already connected account using accounts you control. Local automated/browser tests have not been run for this update, as requested.

## Database file for the password-first screen order

For an existing deployment that already ran mandatory TOTP and the profile-policy repair, this update needs no new tables, functions or policies. Copy the whole `password_setup_database_check.sql` file into a new Supabase SQL Editor query and run it to check those prerequisites. It is read-only and can be run again; every result should say PASS. If a result says CHECK REQUIRED, review it before deploying rather than running unrelated setup/rollback scripts. A passing configuration check is not a substitute for the user-flow checks below. No SQL has been applied automatically.

The three-step guide appears at the top of the password form and on the following authenticator screen. Returning users whose password is already set keep the usual password-login → authenticator → dashboard flow. This update does not add invitations or change administrator-issued temporary passwords.

## Lost device

There is no self-service button that removes mandatory MFA and no invented recovery codes. Verify the person's identity through your office process. An authorized project owner can manage the affected user's MFA factors through Supabase's trusted administration tools (or the server-side Admin MFA API). Revoke that user's sessions as part of recovery, remove the lost factor, and have the user sign in and scan a new QR. Never put a service-role key in browser code. For a lost administrator authenticator, the project owner must perform recovery.

## Release checks

Use accounts you control; do not share real setup secrets or tokens in test output.

1. Existing admin and existing personnel without a factor both see setup, including on direct dashboard URLs and with an existing password-only session.
2. A new temporary-password account sees Step 1 before any OTP/QR, chooses a password, completes TOTP in Step 2, and reaches its own dashboard immediately. The temporary password no longer works after saving; the next fresh sign-in uses the new password and the existing authenticator.
3. An enrolled account sees code entry without a new QR. Incorrect/expired codes keep the portal inaccessible. Leading-zero codes work; setup-key letters cannot be submitted as an OTP.
4. Reload a verified session and navigate using browser Back/Forward. There should be no repeated setup and no permanently visible loader.
5. Test recovery email, lost device recovery, maintenance enable/disable, admin account creation and both roles' normal workflows.
6. At the API/database level, a password-only session can read its own profile but cannot read inventory/requests/audit data, update profiles, manage accounts, or access private request letters. After MFA, the original ownership, role and maintenance restrictions still apply.

The code's automated tests use mocked Auth and an isolated database fixture. They do not enroll real users or change the live project. Production email delivery, phone scanning and the project's TOTP settings still need the release checks above.

For this password-first update, regression checks were updated but not executed, as requested. Verification was limited to source review and read-only checks of the live database; no production account, password, factor or policy was changed.

References: [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp), [MFA enforcement](https://supabase.com/docs/guides/auth/auth-mfa), [Admin MFA](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor).
