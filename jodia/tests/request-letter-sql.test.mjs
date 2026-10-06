// Local-only PostgreSQL integration check. Install @electric-sql/pglite in a
// temporary folder, then pass its dist/index.js path as the first argument.
// Never connects to Supabase or any live database.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

process.on('uncaughtException', error => {
  console.error('SQL test failed:', error.message, error.where || '');
  process.exit(1);
});

const engineUrl = pathToFileURL(process.argv[2]);
const { PGlite } = await import(engineUrl.href);
const { pgcrypto } = await import(new URL('./contrib/pgcrypto.js', engineUrl).href);
const db = new PGlite({ extensions: { pgcrypto } });
const sqlRoot = new URL('../supabase/', import.meta.url);
const runFile = async file => db.exec(await readFile(new URL(file, sqlRoot), 'utf8'));
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const user = async id => {
  await db.exec('RESET ROLE');
  await query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('SET ROLE authenticated');
};
const denied = async (sql, args, pattern) => assert.rejects(query(sql, args), pattern);

await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
  CREATE EXTENSION pgcrypto;
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
  CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT current_user::TEXT $$;
  CREATE TABLE auth.users (
    instance_id UUID, id UUID PRIMARY KEY, aud TEXT, role TEXT, email TEXT,
    encrypted_password TEXT, email_confirmed_at TIMESTAMPTZ, invited_at TIMESTAMPTZ,
    confirmation_token TEXT, recovery_token TEXT, email_change_token_new TEXT,
    email_change_token_current TEXT, email_change TEXT, phone_change TEXT,
    phone_change_token TEXT, reauthentication_token TEXT,
    created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
    raw_app_meta_data JSONB, raw_user_meta_data JSONB,
    is_super_admin BOOLEAN, is_sso_user BOOLEAN, is_anonymous BOOLEAN
  );
  CREATE TABLE auth.identities (
    id UUID PRIMARY KEY, user_id UUID REFERENCES auth.users(id), provider_id TEXT NOT NULL,
    identity_data JSONB, provider TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
    UNIQUE (provider_id, provider)
  );
  CREATE TABLE storage.buckets (id TEXT PRIMARY KEY, name TEXT, public BOOLEAN,
    file_size_limit BIGINT, allowed_mime_types TEXT[]);
  CREATE TABLE storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id), name TEXT, metadata JSONB,
    UNIQUE (bucket_id, name));
  CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS
    $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA auth, storage TO authenticated, anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
  CREATE PUBLICATION supabase_realtime;
`);
await runFile('full_setup_with_admin.sql');
await runFile('personnel_requests_and_seed_traceability.sql');
await runFile('system_maintenance_settings.sql');
await runFile('reserved_stock_and_realtime.sql');
await runFile('personnel_request_cancellation.sql');
await runFile('request_status_released.sql');
await runFile('security_inventory_hardening.sql');
const before = await query('SELECT id, full_name, role, is_active FROM public.profiles ORDER BY id');
const adminId = before.find(row => row.role === 'admin').id;
const originalSeed = (await query('SELECT id FROM public.seeds LIMIT 1'))[0].id;
await query("INSERT INTO public.requests(user_id,seed_id,quantity,purpose,status) VALUES($1,$2,1,'Existing request','PENDING')", [adminId, originalSeed]);
const inventoryBefore = await query('SELECT id, quantity, reserved_quantity FROM public.seeds ORDER BY id');
const requestsBefore = await query('SELECT id, user_id, seed_id, quantity, purpose, status FROM public.requests ORDER BY id');
await runFile('account_management_and_request_letters.sql');
await runFile('account_management_and_request_letters.sql');
assert.deepEqual(await query('SELECT id, full_name, role, is_active FROM public.profiles ORDER BY id'), before);
assert.deepEqual(await query('SELECT id, quantity, reserved_quantity FROM public.seeds ORDER BY id'), inventoryBefore);
assert.deepEqual(await query('SELECT id, user_id, seed_id, quantity, purpose, status FROM public.requests ORDER BY id'), requestsBefore);
await user(adminId);
const create = async (email, role) => (await query(
  'SELECT public.create_new_user_account($1, $2, $3, $4) AS account',
  [email, 'Test account', role, 'TemporaryPassword123!']))[0].account;
const personnel = await create('staff@example.com', 'personnel');
const second = await create('second@example.com', 'personnel');
const newAdmin = await create('newadmin@example.com', 'admin');
await denied('SELECT public.create_new_user_account($1,$2,$3,$4)',
  ['invalid@example.com', 'Test', 'super_admin', 'TemporaryPassword123!'], /Choose Personnel/);
await denied('SELECT public.create_new_user_account($1,$2,$3,$4)',
  ['staff@example.com', 'Test', 'admin', 'TemporaryPassword123!'], /already exists/);
await denied('SELECT public.create_new_user_account($1,$2,$3,$4)',
  ['short@example.com', 'Test', 'admin', 'short'], /12 characters/);
await db.exec('RESET ROLE');
const created = (await query(`SELECT u.role AS auth_role, p.role, p.requires_password_change,
  i.provider_id, i.identity_data->>'email' AS identity_email,
  u.encrypted_password = crypt($1, u.encrypted_password) AS password_works
  FROM auth.users u JOIN public.profiles p ON p.id=u.id
  JOIN auth.identities i ON i.user_id=u.id WHERE u.id=$2`, ['TemporaryPassword123!', newAdmin.user_id]))[0];
assert.equal(created.role, 'admin');
assert.equal(created.auth_role, 'authenticated');
assert.equal(created.requires_password_change, true);
assert.equal(created.password_works, true);
assert.equal(created.provider_id, newAdmin.user_id);
assert.equal(created.identity_email, 'newadmin@example.com');
const publicSignup = randomUUID();
await query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',
  [publicSignup, 'signup@example.com', { role: 'admin', full_name: 'Public signup' }]);
assert.equal((await query('SELECT role FROM public.profiles WHERE id=$1', [publicSignup]))[0].role, 'personnel');
await user(newAdmin.user_id);
assert.equal((await create('byadmin@example.com', 'personnel')).role, 'personnel');
await user(personnel.user_id);
await denied('SELECT public.create_new_user_account($1,$2,$3,$4)',
  ['forged@example.com', 'Test', 'admin', 'TemporaryPassword123!'], /Only active administrators/);
await db.exec('RESET ROLE');
await query('UPDATE public.profiles SET is_active=false WHERE id=$1', [newAdmin.user_id]);
await user(newAdmin.user_id);
await denied('SELECT public.create_new_user_account($1,$2,$3,$4)',
  ['disabled@example.com', 'Test', 'admin', 'TemporaryPassword123!'], /Only active administrators/);
await db.exec('SET ROLE anon');
await denied('SELECT public.create_new_user_account($1,$2,$3,$4)',
  ['anon@example.com', 'Test', 'admin', 'TemporaryPassword123!'], /permission denied/);
await db.exec('RESET ROLE');
const seed = (await query('SELECT id FROM public.seeds LIMIT 1'))[0].id;
await user(personnel.user_id);
const requestId = randomUUID();
const path = `${personnel.user_id}/${requestId}/${randomUUID()}.docx`;
const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const upload = async (name, type = mime, size = 123) => query(
  "INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('request-letters',$1,$2)",
  [name, { mimetype: type, size }]);
await upload(path);
await query(`INSERT INTO public.requests(id,user_id,seed_id,quantity,status,
  request_letter_path,request_letter_name,request_letter_type,request_letter_size)
  VALUES($1,$2,$3,1,'PENDING',$4,'Letter.docx',$5,123)`, [requestId, personnel.user_id, seed, path, mime]);
// Optional fields also work without a letter, including decimal quantities.
await query("INSERT INTO public.requests(user_id,seed_id,quantity,status) VALUES($1,$2,0.5,'PENDING')", [personnel.user_id, seed]);
await denied('UPDATE public.requests SET request_letter_path=NULL WHERE id=$1', [requestId], /submitted request letter|Personnel may only cancel/);
await query("UPDATE public.requests SET status='CANCELLED' WHERE id=$1", [requestId]);
// Existing cancellation and approval triggers coexist with attachment protection.
assert.equal((await query('SELECT name FROM storage.objects WHERE name=$1', [path])).length, 1);
const insertLetter = (id, letterPath, type = mime, size = 123) => query(`
  INSERT INTO public.requests(id,user_id,seed_id,quantity,status,
    request_letter_path,request_letter_name,request_letter_type,request_letter_size)
  VALUES($1,$2,$3,1,'PENDING',$4,'Letter.docx',$5,$6)`, [id, personnel.user_id, seed, letterPath, type, size]);
await assert.rejects(insertLetter(randomUUID(), path), /Invalid request letter path/);
const missingId = randomUUID();
await assert.rejects(insertLetter(missingId, `${personnel.user_id}/${missingId}/${randomUUID()}.docx`), /Upload the matching/);
const largeId = randomUUID();
const largePath = `${personnel.user_id}/${largeId}/${randomUUID()}.docx`;
await upload(largePath, mime, 10485761);
await assert.rejects(insertLetter(largeId, largePath, mime, 10485761), /at most 10 MB/);
const mismatchId = randomUUID();
const mismatchPath = `${personnel.user_id}/${mismatchId}/${randomUUID()}.png`;
await upload(mismatchPath, 'text/html', 123);
await assert.rejects(insertLetter(mismatchId, mismatchPath, 'image/png'), /Upload the matching/);
const maximumId = randomUUID();
const maximumPath = `${personnel.user_id}/${maximumId}/${randomUUID()}.pdf`;
await upload(maximumPath, 'application/pdf', 10485760);
await insertLetter(maximumId, maximumPath, 'application/pdf', 10485760);
await user(adminId);
for (const status of ['APPROVED', 'READY_FOR_RELEASE', 'RELEASED']) {
  await query('UPDATE public.requests SET status=$1 WHERE id=$2', [status, maximumId]);
}
assert.equal((await query('SELECT request_letter_path FROM public.requests WHERE id=$1', [maximumId]))[0].request_letter_path, maximumPath);
await user(personnel.user_id);
await query('DELETE FROM storage.objects WHERE name=$1', [path]);
assert.equal((await query('SELECT name FROM storage.objects WHERE name=$1', [path])).length, 1);
const unlinked = `${personnel.user_id}/${randomUUID()}/${randomUUID()}.pdf`;
await upload(unlinked, 'application/pdf');
await query('DELETE FROM storage.objects WHERE name=$1', [unlinked]);
assert.equal((await query('SELECT name FROM storage.objects WHERE name=$1', [unlinked])).length, 0);
await user(second.user_id);
assert.equal((await query('SELECT name FROM storage.objects WHERE name=$1', [path])).length, 0);
await denied("INSERT INTO storage.objects(bucket_id,name) VALUES('request-letters',$1)", [path + 'x'], /row-level security/);
await user(adminId);
assert.equal((await query('SELECT name FROM storage.objects WHERE name=$1', [path])).length, 1);
await db.exec('RESET ROLE');
await query('UPDATE public.profiles SET is_active=false WHERE id=$1', [personnel.user_id]);
await user(personnel.user_id);
assert.equal((await query('SELECT name FROM storage.objects WHERE name=$1', [path])).length, 0);
await denied("INSERT INTO storage.objects(bucket_id,name) VALUES('request-letters',$1)", [unlinked], /row-level security/);
await db.exec('RESET ROLE');
await query('UPDATE public.profiles SET is_active=true WHERE id=$1', [personnel.user_id]);
await query('UPDATE public.system_settings SET maintenance_enabled=true');
await user(personnel.user_id);
await denied("INSERT INTO storage.objects(bucket_id,name) VALUES('request-letters',$1)", [unlinked], /row-level security/);
await db.exec('RESET ROLE');
const bucket = (await query("SELECT * FROM storage.buckets WHERE id='request-letters'"))[0];
assert.equal(bucket.public, false);
assert.equal(Number(bucket.file_size_limit), 10485760);
assert.equal(bucket.allowed_mime_types.length, 5);
await db.close();
console.log('PASS: SQL applies twice, preserves old accounts, creates both roles with password/identity, denies unauthorized creation, and enforces private attachment ownership, immutability, cleanup, inactive accounts, and maintenance.');
