Apply the database update before publishing the new frontend.

1. Open `account_management_and_request_letters.sql` from this folder.
2. Copy the entire file.
3. Open your existing DENR project in Supabase.
4. Go to SQL Editor, select New query, paste the SQL, and click Run.
5. The final result should show `request-letters`, `public = false`, and
   `file_size_limit = 10485760`. The file can be run again if needed.
6. After the SQL succeeds, commit and push the frontend changes using your
   existing GitHub Desktop workflow. Wait for your hosting deployment to finish.
7. Refresh the system and check Account Management and a personnel seed request.

The update preserves existing accounts, seed inventory, requests, and history.
New accounts use the selected Personnel or Admin role and must change their
temporary password after signing in. Existing account roles are retained.

Planting Site / Location, Contact Number, and Purpose of Request are optional.
Request letters are also optional: one PDF, JPG/JPEG, PNG, DOC, or DOCX file,
at most 10 MB per request. Files use a private bucket. The requester and active
admins can access them. Linked files cannot be overwritten or removed by a
personnel account. Request approval and cancellation preserve the attachment.

Admins open View Request Letter from Seed Requests. Images and PDFs preview
inside the system. Word files have Open File and Download File options and are
viewed using Word or another document app. With no file, the viewer shows
No attachment submitted. Repeating a request starts with no attachment; attach
a new file if needed.

Local checks completed: production build, 11 automated workflow checks,
headless Chrome desktop/mobile checks, and PostgreSQL integration checks using
a temporary PGlite database. These checks did not connect to the live database.
Real Supabase login, Storage API, and deployed-host behavior still need the
usual smoke check after applying the SQL and deploying.

If a submission says it could not be confirmed, refresh My Requests before
retrying. A lost network response may hide a successful submission.

Developer checks from the `jodia` folder:

```powershell
npm test
npm run build
# Optional local PostgreSQL integration check, with PGlite installed outside the project:
node tests/request-letter-sql.test.mjs "PATH_TO_PGLITE/dist/index.js"
# Optional browser check, with Playwright available locally and Chrome installed:
node tests/account-request-browser.test.cjs "PATH_TO_PLAYWRIGHT_PACKAGE"
```
