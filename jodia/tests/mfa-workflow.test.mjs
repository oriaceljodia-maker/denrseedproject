import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

const root = new URL('../', import.meta.url);
async function load(file, stubs = {}, globals = {}) {
  const context = createContext({ console, ...globals });
  const cache = new Map();
  async function get(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const stub = stubs[url.href.slice(root.href.length)];
    const module = stub
      ? new SyntheticModule(Object.keys(stub), function () {
        for (const [key, value] of Object.entries(stub)) this.setExport(key, value);
      }, { context, identifier: url.href })
      : new SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
    cache.set(url.href, module);
    return module;
  }
  const module = await get(new URL(file, root));
  await module.link((specifier, parent) => get(new URL(specifier, parent.identifier)));
  await module.evaluate();
  return module.namespace;
}
const verifiedFactor = { id: 'connected', factor_type: 'totp', status: 'verified' };
function mockAuth({ level = 'aal1', factors = [], fail = null } = {}) {
  const calls = { enrolled: 0, removed: [], verified: [] };
  const mfa = {
    listFactors: async () => ({ data: { all: factors, totp: factors.filter(f => f.factor_type === 'totp' && f.status === 'verified') }, error: null }),
    getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: level }, error: null }),
    enroll: async () => {
      calls.enrolled++;
      return { data: { id: 'new-factor', totp: { qr_code: '<svg fill="#111"></svg>', secret: 'TEST-SECRET-ONLY', uri: 'otpauth://test' } }, error: null };
    },
    unenroll: async ({ factorId }) => { calls.removed.push(factorId); return { error: null }; },
    challengeAndVerify: async data => {
      calls.verified.push(data);
      if (!fail) { level = 'aal2'; factors = [verifiedFactor]; }
      return { error: fail };
    }
  };
  return { supabase: { auth: { mfa } }, calls, mfa };
}
async function service(backend) {
  return (await load('src/services/mfa.service.js', { 'src/config/supabase.js': { supabase: backend.supabase } })).MfaService;
}

function browserStorageFixture() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('Remember me retains only the native session and never bypasses a fresh password-only MFA check', async () => {
  const localStorage = browserStorageFixture();
  const sessionStorage = browserStorageFixture();
  const key = 'sb-fixture-auth-token';
  const storedSession = JSON.stringify({ access_token: 'fixture-aal2-token', refresh_token: 'fixture-refresh-token' });
  const { AuthSessionStorage: storage } = await load('src/config/auth-session-storage.js', {}, { localStorage, sessionStorage });
  storage.setRememberMe(true);
  storage.setItem(key, storedSession);
  assert.equal(localStorage.getItem(key), storedSession);
  assert.equal(sessionStorage.getItem(key), null);

  const newTab = browserStorageFixture();
  const { AuthSessionStorage: reopened } = await load('src/config/auth-session-storage.js', {}, { localStorage, sessionStorage: newTab });
  assert.equal(reopened.isRemembered(), true);
  assert.equal(reopened.getItem(key), storedSession);
  const { Guards } = await load('src/router/guards.js', {}, { sessionStorage: newTab });
  assert.equal(Guards.determineTargetRoute({ role: 'personnel', mfaVerified: false }, '/personnel/dashboard'), '/verify-authenticator');
  assert.equal(Guards.determineTargetRoute({ role: 'personnel', mfaVerified: true }, '/login'), '/personnel/dashboard');

  storage.clear();
  reopened.clear(); // The other tab's SIGNED_OUT handler also clears its state.
  assert.equal(localStorage.getItem(key), null);
  assert.equal(reopened.getItem(key), null);
  assert.equal(reopened.isRemembered(), false);
});

test('unchecked sign-in survives a tab refresh but is not persisted for a new browser tab', async () => {
  const localStorage = browserStorageFixture();
  const sessionStorage = browserStorageFixture();
  const key = 'sb-fixture-auth-token';
  const { AuthSessionStorage: storage } = await load('src/config/auth-session-storage.js', {}, { localStorage, sessionStorage });
  storage.setRememberMe(false);
  storage.setItem(key, 'fixture-session');
  assert.equal(localStorage.getItem(key), null);
  assert.equal(sessionStorage.getItem(key), 'fixture-session');
  const { AuthSessionStorage: refreshed } = await load('src/config/auth-session-storage.js', {}, { localStorage, sessionStorage });
  assert.equal(refreshed.getItem(key), 'fixture-session');
  const { AuthSessionStorage: reopened } = await load('src/config/auth-session-storage.js', {}, { localStorage, sessionStorage: browserStorageFixture() });
  assert.equal(reopened.getItem(key), null);
});

test('pre-checkbox sessions move into the current tab without silently enabling Remember me', async () => {
  const localStorage = browserStorageFixture();
  const sessionStorage = browserStorageFixture();
  const key = 'sb-fixture-auth-token';
  localStorage.setItem(key, 'legacy-fixture-session');
  const { AuthSessionStorage: storage } = await load('src/config/auth-session-storage.js', {}, { localStorage, sessionStorage });
  assert.equal(storage.getItem(key), 'legacy-fixture-session');
  assert.equal(storage.isRemembered(), false);
  assert.equal(localStorage.getItem(key), null);
  assert.equal(sessionStorage.getItem(key), 'legacy-fixture-session');
});

test('blocked browser storage cannot pretend to remember a user and still supports memory-only sign-in', async () => {
  const blocked = { getItem: () => null, setItem: () => { throw new Error('Blocked'); }, removeItem() {} };
  const { AuthSessionStorage: storage } = await load('src/config/auth-session-storage.js', {}, { localStorage: blocked, sessionStorage: blocked });
  assert.throws(() => storage.setRememberMe(true), /Uncheck Remember me/);
  storage.setRememberMe(false);
  storage.setItem('sb-fixture-auth-token', 'memory-fixture-session');
  assert.equal(storage.getItem('sb-fixture-auth-token'), 'memory-fixture-session');
  storage.clear();
  assert.equal(storage.getItem('sb-fixture-auth-token'), null);
});

test('login passes the explicit remember preference to session storage before native password sign-in', async () => {
  const calls = [];
  const { AuthService } = await load('src/services/auth.service.js', {
    'src/config/supabase.js': { supabase: { auth: {
      signInWithPassword: async credentials => {
        calls.push('password-sign-in');
        assert.equal(credentials.password, 'FixturePasswordOnly!');
        return { data: {}, error: null };
      }
    } } },
    'src/config/auth-session-storage.js': { AuthSessionStorage: { setRememberMe: value => calls.push(value) } },
    'src/services/profile.service.js': { ProfileService: {} },
    'src/services/mfa.service.js': { MfaService: { clear() {} } }
  }, { sessionStorage: { removeItem() {} } });
  await AuthService.login('fixture@example.com', 'FixturePasswordOnly!', true);
  await AuthService.login('fixture@example.com', 'FixturePasswordOnly!');
  assert.deepEqual(calls, [true, 'password-sign-in', false, 'password-sign-in']);
  assert.equal(AuthService.signInInProgress, false);
});

test('temporary-password eye toggles visibility without submitting and resets when reopening', async () => {
  let body;
  let clicks = 0;
  const input = { type: 'password', value: 'FixturePasswordOnly!' };
  const attributes = {};
  const toggle = { addEventListener: (event, handler) => { toggle.click = handler; }, setAttribute: (key, value) => { attributes[key] = value; } };
  const { AdminAccountsPage } = await load('src/pages/admin/accounts.page.js', {
    'src/services/user.service.js': { UserService: {} },
    'src/services/access-request.service.js': { AccessRequestService: {} },
    'src/components/toast.component.js': { ToastComponent: {} },
    'src/components/modal.component.js': { ModalComponent: { open: options => { body = options.bodyHtml; input.type = 'password'; } } }
  }, { document: { getElementById: id => id === 'new-user-password' ? input : toggle } });
  AdminAccountsPage.createUser = () => { clicks++; };
  AdminAccountsPage.openCreateUserModal();
  assert.match(body, /type="button" id="toggle-new-user-password"/);
  toggle.click();
  assert.equal(input.type, 'text');
  assert.equal(attributes['aria-label'], 'Hide temporary password');
  toggle.click();
  assert.equal(input.type, 'password');
  assert.equal(attributes['aria-pressed'], 'false');
  assert.equal(input.value, 'FixturePasswordOnly!');
  assert.equal(clicks, 0);
  AdminAccountsPage.openCreateUserModal();
  assert.equal(input.type, 'password');
});

test('profile policy recursion is reported immediately without claiming an active account is missing', async () => {
  let reads = 0;
  const { AuthService } = await load('src/services/auth.service.js', {
    'src/config/supabase.js': { supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => {
        reads++;
        return { data: null, error: { code: '42P17', message: 'infinite recursion' } };
      } }) }) })
    } },
    'src/services/profile.service.js': { ProfileService: {} },
    'src/services/mfa.service.js': { MfaService: {} }
  });
  await assert.rejects(AuthService.getCurrentUser(), /system access configuration error/);
  assert.equal(reads, 1);
});

test('password setup checks exactly one saved profile and preserves recovery state on database rejection', async () => {
  for (const profileError of [null, { code: '42P17' }, { code: 'PGRST116' }]) {
    const calls = [];
    const { AuthService } = await load('src/services/auth.service.js', {
      'src/config/supabase.js': { supabase: {
        auth: {
          getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }),
          updateUser: async () => { calls.push('password'); return { data: { user: { id: 'owner' } }, error: null }; }
        },
        from: table => {
          assert.equal(table, 'profiles');
          return { update: values => {
            assert.equal(values.requires_password_change, false);
            return { eq: (column, id) => {
              assert.equal(column, 'id'); assert.equal(id, 'owner');
              return { select: column => {
                assert.equal(column, 'id');
                return { single: async () => { calls.push('profile'); return { error: profileError }; } };
              } };
            } };
          } };
        }
      } },
      'src/services/profile.service.js': { ProfileService: {} },
      'src/services/mfa.service.js': { MfaService: { getStatus: async () => ({ verified: true }) } }
    }, { sessionStorage: { removeItem: () => calls.push('clear-recovery') } });
    if (profileError) {
      await assert.rejects(AuthService.updatePassword('NewPasswordForFixture!'), /Use your NEW password/);
      assert.deepEqual(calls, ['password', 'profile']);
    } else {
      await AuthService.updatePassword('NewPasswordForFixture!');
      assert.deepEqual(calls, ['password', 'profile', 'clear-recovery']);
    }
  }
});

test('expired sessions cannot initiate a password change', async () => {
  const { AuthService } = await load('src/services/auth.service.js', {
    'src/config/supabase.js': { supabase: { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } },
    'src/services/profile.service.js': { ProfileService: {} },
    'src/services/mfa.service.js': { MfaService: {} }
  });
  await assert.rejects(AuthService.updatePassword('NewPasswordForFixture!'), /session has expired/);
});

test('both roles choose required passwords first but cannot skip MFA to reach a protected route', async () => {
  const values = new Map();
  const { Guards } = await load('src/router/guards.js', {}, { sessionStorage: { getItem: key => values.get(key) } });
  for (const role of ['admin', 'personnel']) {
    for (const path of ['/admin/dashboard', '/personnel/catalog', '/profile', '/force-password', '/login']) {
      assert.equal(Guards.determineTargetRoute({ role }, path), '/verify-authenticator');
      assert.equal(Guards.determineTargetRoute({ role, mfaVerified: false, requiresPasswordChange: true }, path), '/force-password');
      assert.equal(Guards.determineTargetRoute({ role, mfaVerified: false, requiresPasswordChange: true, passwordSetupReady: true }, path), '/verify-authenticator');
      assert.equal(Guards.determineTargetRoute({ role, mfaVerified: true, requiresPasswordChange: true, passwordSetupReady: true }, path), '/verify-authenticator');
    }
  }
  values.set('denr-password-recovery', 'true');
  assert.equal(Guards.determineTargetRoute({ role: 'admin' }, '/force-password'), '/force-password');
  assert.equal(Guards.determineTargetRoute({ role: 'admin', mfaVerified: true }, '/verify-authenticator'), '/force-password');
  assert.equal(Guards.determineTargetRoute(null, '/verify-authenticator'), '/login');
});

test('password-first setup waits for MFA, retries only the profile after a partial save, and forgets cancelled/account-switched setup', async () => {
  for (const role of ['admin', 'personnel']) {
    let verified = false;
    let rejectProfile = true;
    let activeId = 'owner';
    const calls = [];
    const profile = { full_name: 'Fixture', role, is_active: true, requires_password_change: true };
    const { AuthService } = await load('src/services/auth.service.js', {
      'src/config/supabase.js': { supabase: {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: activeId, email: 'fixture@example.com' } } } }),
          getUser: async () => ({ data: { user: { id: activeId } }, error: null }),
          updateUser: async ({ password }) => {
            assert.equal(verified, true);
            assert.equal(password, 'ChosenPasswordFixture!');
            calls.push('password');
            return { data: { user: { id: activeId } }, error: null };
          },
          signOut: async () => ({ error: null })
        },
        from: () => ({
          select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: null }) }) }),
          update: () => ({ eq: () => ({ select: () => ({ single: async () => {
            calls.push('profile');
            if (rejectProfile) return { error: { code: '42P17' } };
            profile.requires_password_change = false;
            return { data: { id: activeId }, error: null };
          } }) }) })
        })
      } },
      'src/services/profile.service.js': { ProfileService: { getAvatarUrl: () => '' } },
      'src/services/mfa.service.js': { MfaService: { getStatus: async () => ({ verified }), clear() {} } }
    }, { sessionStorage: { removeItem() {} } });
    AuthService.preparePasswordSetup('owner', 'ChosenPasswordFixture!');
    assert.equal((await AuthService.getCurrentUser()).passwordSetupReady, true);
    assert.deepEqual(calls, []);
    await assert.rejects(AuthService.completePasswordSetup(), /Verify your authenticator/);
    assert.deepEqual(calls, []);
    verified = true;
    await assert.rejects(AuthService.completePasswordSetup(), /Continue setup/);
    assert.deepEqual(calls, ['password', 'profile']);
    rejectProfile = false;
    await AuthService.completePasswordSetup();
    assert.deepEqual(calls, ['password', 'profile', 'profile']);
    const user = await AuthService.getCurrentUser();
    assert.equal(user.passwordSetupReady, false);
    assert.equal(user.requiresPasswordChange, false);
    await assert.rejects(AuthService.completePasswordSetup(), /Step 1/);
    AuthService.preparePasswordSetup('owner', 'ChosenPasswordFixture!');
    await AuthService.logout();
    assert.equal((await AuthService.getCurrentUser()).passwordSetupReady, false);
    AuthService.preparePasswordSetup('owner', 'ChosenPasswordFixture!');
    activeId = 'other-account';
    assert.equal((await AuthService.getCurrentUser()).passwordSetupReady, false);
    await assert.rejects(AuthService.completePasswordSetup(), /Step 1/);
  }
});

test('verified sessions keep role restrictions and new passwords remain required', async () => {
  const { Guards } = await load('src/router/guards.js', {}, { sessionStorage: { getItem: () => null } });
  assert.equal(Guards.determineTargetRoute({ role: 'admin', mfaVerified: true }, '/verify-authenticator'), '/admin/dashboard');
  assert.equal(Guards.determineTargetRoute({ role: 'personnel', mfaVerified: true }, '/admin/accounts'), '/personnel/dashboard');
  assert.equal(Guards.determineTargetRoute({ role: 'admin', mfaVerified: true }, '/personnel/catalog'), '/admin/dashboard');
  assert.equal(Guards.determineTargetRoute({ role: 'personnel', mfaVerified: true, requiresPasswordChange: true }, '/verify-authenticator'), '/force-password');
});

test('password screen stages the choice and opens MFA without saving or signing out', async () => {
  const elements = new Map();
  let onSubmit;
  const element = () => ({ value: '', isConnected: true, style: {}, addEventListener() {} });
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    querySelectorAll: () => []
  };
  const form = document.getElementById('password-reset-form');
  form.addEventListener = (event, handler) => { if (event === 'submit') onSubmit = handler; };
  form.reset = () => {
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  };
  const calls = [];
  const { ForcePasswordPage } = await load('src/pages/auth/force-password.page.js', {
    'src/services/auth.service.js': { AuthService: {
      getCurrentUser: async () => ({ id: 'owner', role: 'personnel', requiresPasswordChange: true, mfaVerified: false }),
      preparePasswordSetup: (id, password) => calls.push(['stage', id, password]),
      updatePassword: () => assert.fail('Must not save before authenticator verification'),
      logout: () => assert.fail('Must not sign out during successful setup')
    } },
    'src/router/router.js': { Router: { navigate: async (user, path) => calls.push(['navigate', user.passwordSetupReady, path]) } }
  }, { document });
  assert.match(ForcePasswordPage.render(), /Account setup progress/);
  ForcePasswordPage.bindEvents();
  document.getElementById('new-password').value = 'ChosenPasswordFixture!';
  document.getElementById('confirm-password').value = 'DoesNotMatchFixture!';
  await onSubmit({ preventDefault() {} });
  assert.deepEqual(calls, []);
  document.getElementById('confirm-password').value = 'ChosenPasswordFixture!';
  await onSubmit({ preventDefault() {} });
  assert.deepEqual(calls, [['stage', 'owner', 'ChosenPasswordFixture!'], ['navigate', true, '/verify-authenticator']]);
  assert.equal(document.getElementById('new-password').value, '');
});

test('password-only, stale AAL2 and phone-only sessions never satisfy TOTP', async () => {
  for (const options of [{ factors: [verifiedFactor] }, { level: 'aal2' }, { level: 'aal2', factors: [{ ...verifiedFactor, factor_type: 'phone' }] }]) {
    assert.equal((await (await service(mockAuth(options))).getStatus()).verified, false);
  }
  assert.equal((await (await service(mockAuth({ level: 'aal2', factors: [verifiedFactor] }))).getStatus()).verified, true);
});

test('factor lookup or assurance errors fail closed', async () => {
  const backend = mockAuth();
  const mfa = await service(backend);
  backend.mfa.listFactors = async () => ({ error: new Error('Offline') });
  await assert.rejects(mfa.getStatus(), /Offline/);
});

test('interrupted enrollment removes only unverified TOTP and concurrent renders reuse one QR', async () => {
  const backend = mockAuth({ factors: [
    { id: 'unfinished', factor_type: 'totp', status: 'unverified' },
    { id: 'phone', factor_type: 'phone', status: 'verified' }
  ] });
  const mfa = await service(backend);
  const [a, b] = await Promise.all([mfa.beginEnrollment('owner'), mfa.beginEnrollment('owner')]);
  assert.equal(a, b);
  assert.equal(backend.calls.enrolled, 1);
  assert.deepEqual(backend.calls.removed, ['unfinished']);
  assert.equal((await mfa.beginEnrollment('owner')).secret, 'TEST-SECRET-ONLY');
  mfa.clear();
  assert.equal(mfa.pendingEnrollment, null);
});

test('existing verified factors are never deleted or replaced by setup', async () => {
  const backend = mockAuth({ factors: [verifiedFactor] });
  await assert.rejects((await service(backend)).beginEnrollment('owner'), /already connected/);
  assert.deepEqual(backend.calls.removed, []);
  assert.equal(backend.calls.enrolled, 0);
});

test('sign-out during enrollment cannot restore a secret into memory', async () => {
  const backend = mockAuth();
  let finish;
  backend.mfa.enroll = () => new Promise(resolve => { finish = resolve; });
  const mfa = await service(backend);
  const pending = mfa.beginEnrollment('owner');
  await new Promise(resolve => setImmediate(resolve));
  mfa.clear();
  finish({ data: { id: 'id', totp: { qr_code: '<svg/>', secret: 'never-store' } }, error: null });
  await assert.rejects(pending, /cancelled/);
  assert.equal(mfa.pendingEnrollment, null);
});

test('QR works for raw SVG and SDK data URLs containing color hashes', async () => {
  const mfa = await service(mockAuth());
  for (const qr of ['<svg fill="#123"></svg>', 'data:image/svg+xml;utf-8,<svg fill="#123"></svg>']) {
    const src = mfa.qrImageSource(qr);
    assert.ok(!src.includes('#'));
    assert.equal(decodeURIComponent(src.split(',')[1]), '<svg fill="#123"></svg>');
  }
  const encoded = 'data:image/svg+xml,%3Csvg%2F%3E';
  assert.equal(mfa.qrImageSource(encoded), encoded);
  assert.throws(() => mfa.qrImageSource('https://third-party.example/secret'), /could not be displayed/);
});

test('invalid/expired codes never complete MFA; valid leading-zero codes are forwarded intact', async () => {
  const backend = mockAuth();
  const mfa = await service(backend);
  for (const code of ['SETUPKEY', '12345', '1234567', '', '12 456']) {
    await assert.rejects(mfa.verify('factor', code), /six-digit/);
  }
  assert.equal(backend.calls.verified.length, 0);
  const expired = await service(mockAuth({ fail: new Error('Code expired') }));
  await assert.rejects(expired.verify('factor', '123456'), /expired/);
  await mfa.verify('factor', '001234');
  assert.equal(backend.calls.verified[0].code, '001234');
  assert.equal(mfa.pendingEnrollment, null);
});

test('setup screen displays an encoded QR and key, rejects bad codes and prevents double submission', async () => {
  const backend = mockAuth();
  const elements = new Map();
  const element = () => ({
    isConnected: true, value: '', hidden: true, style: {}, textContent: '',
    focus() {}, appendChild(child) { if (!this.value) this.value = child.value; }
  });
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: () => element()
  };
  const navigations = [];
  let audits = 0;
  const { MfaPage } = await load('src/pages/auth/mfa.page.js', {
    'src/config/supabase.js': { supabase: backend.supabase },
    'src/services/auth.service.js': { AuthService: {
      getCurrentUser: async () => ({ id: 'owner', role: 'personnel', mfaVerified: true }),
      recordSuccessfulLogin: async () => { audits++; }
    } },
    'src/router/router.js': { Router: { navigate: async (...args) => navigations.push(args) } }
  }, { document });
  assert.match(MfaPage.render(), /inputmode="numeric"/);
  assert.match(MfaPage.render(), /pattern="\[0-9\]\{6\}"/);
  await MfaPage.init({ id: 'owner', email: 'staff@example.com' });
  assert.equal(document.getElementById('mfa-enrollment').hidden, false);
  assert.equal(document.getElementById('mfa-form').hidden, false);
  assert.equal(document.getElementById('mfa-setup-key').textContent, 'TEST-SECRET-ONLY');
  assert.ok(!document.getElementById('mfa-qr').src.includes('#'));
  const code = document.getElementById('mfa-code');
  code.value = 'LETTERS'; code.oninput();
  assert.equal(code.value, '');
  await document.getElementById('mfa-form').onsubmit({ preventDefault() {} });
  assert.equal(navigations.length, 0);
  assert.equal(audits, 0);
  assert.equal(backend.calls.verified.length, 0);
  let finish;
  const verify = backend.mfa.challengeAndVerify;
  backend.mfa.challengeAndVerify = async params => {
    await new Promise(resolve => { finish = resolve; });
    return verify(params);
  };
  code.value = '001234';
  const first = document.getElementById('mfa-form').onsubmit({ preventDefault() {} });
  await document.getElementById('mfa-form').onsubmit({ preventDefault() {} });
  assert.equal(document.getElementById('mfa-submit').disabled, true);
  finish();
  await first;
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0][0].mfaVerified, true);
  assert.equal(audits, 1);
  assert.equal(backend.calls.verified.length, 1);
});

test('enrolled users see a challenge without creating or displaying another secret', async () => {
  const backend = mockAuth({ factors: [verifiedFactor] });
  const elements = new Map();
  const element = () => ({ isConnected: true, value: '', hidden: true, style: {}, focus() {}, appendChild(child) { this.value = child.value; } });
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: () => element()
  };
  const { MfaPage } = await load('src/pages/auth/mfa.page.js', {
    'src/config/supabase.js': { supabase: backend.supabase },
    'src/services/auth.service.js': { AuthService: {} },
    'src/router/router.js': { Router: {} }
  }, { document });
  await MfaPage.init({ id: 'owner', email: 'staff@example.com' });
  assert.equal(backend.calls.enrolled, 0);
  assert.equal(document.getElementById('mfa-enrollment').hidden, true);
  assert.equal(document.getElementById('mfa-form').hidden, false);
  assert.equal(elements.has('mfa-setup-key'), false);
});

test('MFA finishes pending passwords in the same session and routes both roles directly to their dashboard', async () => {
  for (const role of ['admin', 'personnel']) {
    for (const level of ['aal1', 'aal2']) {
      const backend = mockAuth({ level, factors: [verifiedFactor] });
      const elements = new Map();
      const element = () => ({ isConnected: true, value: '', hidden: true, style: {}, focus() {}, appendChild(child) { this.value = child.value; } });
      const document = {
        getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
        createElement: element
      };
      let pending = true;
      let saves = 0;
      const paths = [];
      const user = () => ({ id: 'owner', email: 'fixture@example.com', role, mfaVerified: true, passwordSetupReady: pending, requiresPasswordChange: pending });
      const storage = new Map();
      const sessionStorage = {
        getItem: key => storage.get(key),
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
      };
      const { Guards } = await load('src/router/guards.js', {}, { sessionStorage });
      const { MfaPage } = await load('src/pages/auth/mfa.page.js', {
        'src/config/supabase.js': { supabase: backend.supabase },
        'src/services/auth.service.js': { AuthService: {
          getCurrentUser: async () => user(),
          completePasswordSetup: async () => {
            assert.equal(storage.get('denr-password-update-in-progress'), 'true');
            assert.equal((await backend.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel, 'aal2');
            saves++; pending = false;
          },
          recordSuccessfulLogin: async () => {},
          logout: () => assert.fail('Successful setup must not sign out')
        } },
        'src/router/router.js': { Router: { navigate: async (account, path) => paths.push(Guards.determineTargetRoute(account, path)) } }
      }, { document, sessionStorage });
      assert.match(MfaPage.render(user()), /aria-current="step"/);
      await MfaPage.init(user());
      if (level === 'aal1') {
        assert.equal(saves, 0);
        document.getElementById('mfa-code').value = '001234';
        await document.getElementById('mfa-form').onsubmit({ preventDefault() {} });
      }
      assert.equal(saves, 1);
      assert.deepEqual(paths, [role === 'admin' ? '/admin/dashboard' : '/personnel/dashboard']);
      assert.equal(storage.size, 0);
      assert.equal(backend.calls.enrolled, 0);
    }
  }
});

test('auth callback releases the SDK lock and does not re-render an unchanged MFA screen', async () => {
  let callback;
  let start;
  let underLock = false;
  let routes = 0;
  const timers = [];
  const location = { pathname: '/admin/dashboard' };
  const user = { id: 'user', role: 'admin', mfaVerified: false };
  await load('main.js', {
    'src/config/supabase.js': { supabase: { auth: { onAuthStateChange: fn => { callback = fn; } } } },
    'src/services/auth.service.js': { AuthService: {
      isPasswordRecoveryLink: () => false,
      beginPasswordRecovery() {}, clearPasswordRecovery() {},
      getCurrentUser: async () => { assert.equal(underLock, false); return user; }
    } },
    'src/services/mfa.service.js': { MfaService: { clear() {} } },
    'src/services/maintenance.service.js': { MaintenanceService: { unsubscribe() {} } },
    'src/router/router.js': { Router: { navigate: async (u, path) => { routes++; location.pathname = path; } } }
  }, {
    document: { addEventListener: (name, fn) => { start = fn; } },
    sessionStorage: { getItem: () => null },
    window: { location, addEventListener() {}, setTimeout: fn => { timers.push(fn); }, clearTimeout() {} }
  });
  await start();
  assert.equal(location.pathname, '/verify-authenticator');
  underLock = true;
  assert.equal(callback('TOKEN_REFRESHED'), undefined);
  underLock = false;
  timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(routes, 1);
  callback('MFA_CHALLENGE_VERIFIED');
  assert.equal(timers.length, 0);
});
