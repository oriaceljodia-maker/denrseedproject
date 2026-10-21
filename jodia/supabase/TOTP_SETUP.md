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
them sign in with that new password, verify their existing authenticator, and
complete the password setup again using a different new password. Do not delete
and recreate the account or remove its authenticator to resolve this policy error.

## What users see

- Old or new account without verified TOTP: email/password, QR/setup key, first valid code, then password change if required, then the portal after signing in again.
- Account with verified TOTP: email/password, code from the connected app, then the portal.
- Already verified persisted session: refresh/navigation keeps the current MFA session. It does not ask for a code on every click. A fresh password sign-in requires a fresh TOTP challenge. There is no separate “trust this device” bypass.
- Password reset: the recovery link creates a recovery session. A connected user verifies their authenticator before changing the password; an account without TOTP enrolls first. A reset email does not remove MFA.
- Setup interrupted by reload: unfinished factors are discarded and a new QR is displayed. Remove the unfinished entry from Google Authenticator if necessary and scan the new QR. Verified factors are never deleted by setup.
- Maintenance mode: authentication remains usable; the personnel maintenance screen appears only after MFA and required password setup.

The setup key is equivalent to the authenticator secret. It stays in memory only and is displayed for initial connection. Never email it, add it to SQL, publish it, or share screenshots containing it. After setup, only code verification is shown.

## Lost device

There is no self-service button that removes mandatory MFA and no invented recovery codes. Verify the person's identity through your office process. An authorized project owner can manage the affected user's MFA factors through Supabase's trusted administration tools (or the server-side Admin MFA API). Revoke that user's sessions as part of recovery, remove the lost factor, and have the user sign in and scan a new QR. Never put a service-role key in browser code. For a lost administrator authenticator, the project owner must perform recovery.

## Release checks

Use accounts you control; do not share real setup secrets or tokens in test output.

1. Existing admin and existing personnel without a factor both see setup, including on direct dashboard URLs and with an existing password-only session.
2. A new temporary-password account completes TOTP, updates the password, signs in again and verifies a fresh code.
3. An enrolled account sees code entry without a new QR. Incorrect/expired codes keep the portal inaccessible. Leading-zero codes work; setup-key letters cannot be submitted as an OTP.
4. Reload a verified session and navigate using browser Back/Forward. There should be no repeated setup and no permanently visible loader.
5. Test recovery email, lost device recovery, maintenance enable/disable, admin account creation and both roles' normal workflows.
6. At the API/database level, a password-only session can read its own profile but cannot read inventory/requests/audit data, update profiles, manage accounts, or access private request letters. After MFA, the original ownership, role and maintenance restrictions still apply.

The code's automated tests use mocked Auth and an isolated database fixture. They do not enroll real users or change the live project. Production email delivery, phone scanning and the project's TOTP settings still need the release checks above.

References: [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp), [MFA enforcement](https://supabase.com/docs/guides/auth/auth-mfa), [Admin MFA](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor).
