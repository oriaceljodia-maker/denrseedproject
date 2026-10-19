// Real PostgreSQL RLS semantics in an in-memory database, never Supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('mandatory TOTP SQL enforces MFA while preserving bootstrap and role/owner policies', async () => {
  const db = new PGlite();
  const admin = '00000000-0000-4000-8000-000000000001';
  const personnel = '00000000-0000-4000-8000-000000000002';
  const unconnected = '00000000-0000-4000-8000-000000000003';
  const disabled = '00000000-0000-4000-8000-000000000004';
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
      CREATE TABLE auth.mfa_factors (user_id uuid, factor_type text, status text);
      CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text, is_active boolean);
      INSERT INTO public.profiles VALUES ('${admin}', 'admin', true), ('${personnel}', 'personnel', true),
        ('${unconnected}', 'personnel', true), ('${disabled}', 'admin', false);
      INSERT INTO auth.mfa_factors VALUES ('${admin}', 'totp', 'verified'), ('${personnel}', 'totp', 'verified'),
        ('${disabled}', 'totp', 'verified'), ('${unconnected}', 'totp', 'unverified');
      CREATE FUNCTION public.current_user_is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS
        $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role='admin') $$;
      CREATE FUNCTION public.account_management_is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS
        $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role='admin' AND is_active) $$;
      CREATE FUNCTION public.create_new_user_account() RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
        BEGIN IF NOT public.account_management_is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF; RETURN 'created'; END $$;
      CREATE TABLE public.seeds (id int);
      CREATE TABLE public.requests (id int, user_id uuid);
      CREATE TABLE public.system_settings (id int);
      CREATE TABLE public.audit_trail (id int);
      CREATE TABLE public.login_activity (id int);
      CREATE TABLE public.access_requests (id int);
      CREATE TABLE storage.objects (id int, bucket_id text);
      INSERT INTO public.seeds VALUES (1);
      INSERT INTO public.requests VALUES (1, '${personnel}'), (2, '${admin}');
      INSERT INTO public.system_settings VALUES (1);
      INSERT INTO public.audit_trail VALUES (1);
      INSERT INTO public.login_activity VALUES (1);
      INSERT INTO public.access_requests VALUES (1);
      INSERT INTO storage.objects VALUES (1,'request-letters'), (2,'profile-avatars'), (3,'unrelated');
      CREATE FUNCTION public.clear_audit_activity() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS
        $$ BEGIN DELETE FROM public.audit_trail; DELETE FROM public.login_activity; END $$;
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR public.current_user_is_admin());
      CREATE POLICY profile_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());
      ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
      CREATE POLICY request_owner ON public.requests FOR ALL TO authenticated
        USING (user_id=auth.uid() OR public.current_user_is_admin()) WITH CHECK (user_id=auth.uid());
      DO $$ DECLARE t text; BEGIN
        FOREACH t IN ARRAY ARRAY['seeds','system_settings','audit_trail','login_activity','access_requests'] LOOP
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
          EXECUTE format('CREATE POLICY baseline ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
        END LOOP;
      END $$;
      CREATE POLICY public_access_request ON public.access_requests FOR INSERT TO anon WITH CHECK (true);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE POLICY storage_baseline ON storage.objects FOR ALL TO authenticated USING (true) WITH CHECK (true);
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, storage TO authenticated;
      GRANT INSERT ON public.access_requests TO anon;
    `);
    const sql = await readFile(new URL('../supabase/mandatory_totp.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql); // Rerunning the standalone script is safe.
    async function asUser(id, aal, query) {
      await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id, aal })]);
      await db.exec('SET ROLE authenticated');
      try { return (await db.query(query)).rows; }
      finally { await db.exec('RESET ROLE'); }
    }
    for (const id of [admin, personnel, unconnected, disabled]) {
      assert.equal((await asUser(id, 'aal1', 'SELECT * FROM public.profiles')).length, 1);
      for (const table of ['seeds','requests','system_settings','audit_trail','login_activity','access_requests']) {
        assert.equal((await asUser(id, 'aal1', `SELECT * FROM public.${table}`)).length, 0);
      }
      assert.equal((await asUser(id, 'aal1', 'UPDATE public.profiles SET is_active=true RETURNING id')).length, 0);
      assert.equal((await asUser(id, 'aal1', "SELECT * FROM storage.objects WHERE bucket_id='request-letters'")).length, 0);
      await assert.rejects(asUser(id, 'aal1', 'SELECT public.create_new_user_account()'), /Not authorized/);
      await assert.rejects(asUser(id, 'aal1', 'SELECT public.clear_audit_activity()'), /authenticator verification/);
    }
    assert.equal((await asUser(admin, 'aal2', 'SELECT * FROM public.seeds')).length, 1);
    assert.equal((await asUser(admin, 'aal2', 'SELECT * FROM public.profiles')).length, 4);
    assert.equal((await asUser(admin, 'aal2', 'SELECT public.create_new_user_account() AS status'))[0].status, 'created');
    assert.equal((await asUser(personnel, 'aal2', 'SELECT * FROM public.requests')).length, 1);
    assert.equal((await asUser(personnel, 'aal2', 'SELECT * FROM public.profiles')).length, 1);
    assert.equal((await asUser(personnel, 'aal2', 'UPDATE public.profiles SET is_active=true RETURNING id')).length, 1);
    await assert.rejects(asUser(personnel, 'aal2', 'SELECT public.create_new_user_account()'), /Not authorized/);
    assert.equal((await asUser(disabled, 'aal2', 'SELECT * FROM public.seeds')).length, 0);
    assert.equal((await asUser(unconnected, 'aal2', 'SELECT * FROM public.seeds')).length, 0);
    await assert.rejects(asUser(personnel, 'aal1', `INSERT INTO public.requests VALUES (3, '${personnel}')`), /row-level security/);
    await asUser(personnel, 'aal2', `INSERT INTO public.requests VALUES (3, '${personnel}')`);
    await assert.rejects(asUser(personnel, 'aal2', `INSERT INTO public.requests VALUES (4, '${admin}')`), /row-level security/);
    // Removing verified factors invalidates stale AAL2 access at the database.
    await db.exec(`DELETE FROM auth.mfa_factors WHERE user_id='${personnel}'`);
    assert.equal((await asUser(personnel, 'aal2', 'SELECT * FROM public.seeds')).length, 0);
    await db.exec('SET ROLE anon');
    try { await db.exec('INSERT INTO public.access_requests VALUES (2)'); }
    finally { await db.exec('RESET ROLE'); }
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.access_requests')).rows[0].n, 2);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE policyname LIKE 'DENR %' AND permissive='RESTRICTIVE'")).rows[0].n, 13);
  } finally {
    await db.close();
  }
});
