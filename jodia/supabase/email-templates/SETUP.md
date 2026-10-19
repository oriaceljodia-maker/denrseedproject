# Password reset and reauthentication email setup

These files are local only. Nothing is deployed to Supabase by adding them to Git.

1. In Supabase Authentication > Email Templates, copy `reset-password.html` into **Reset password** and `reauthentication.html` into **Reauthentication**. Suggested subjects: “Reset your DENR Talipan password” and “Your DENR Talipan verification code”. Preserve the `{{ .ConfirmationURL }}` and `{{ .Token }}` variables.
2. Confirm SMTP works and that the sender is authorized for your domain. Configure your exact production site URL and allow `https://denrtalipan.netlify.app/force-password` in Authentication > URL Configuration. Use your actual site URL if it differs.
3. Account Management uses the existing `create_new_user_account` database function. The administrator enters a temporary password of at least 12 characters and shares it privately with the user. The existing first-login password-change screen remains in use. No new Edge Function is required for this flow.
4. Check Forgot Password with an account you control: request the reset email, follow its link, set a new password, and sign in. Also check expired or already used links.
5. The reauthentication template is provided, but a new code-entry flow has not been added. Supabase documents that sessions created in the past 24 hours are considered recent and may change passwords without reauthentication, even when its **Require reauthentication when changing password** setting is enabled. A template alone does not activate this flow. Test recovery and first-login password setup before changing the setting in production.

No new SQL is required to restore this existing account-creation flow or copy these two templates. No database changes are run automatically.
