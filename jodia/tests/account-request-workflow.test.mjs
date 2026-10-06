// Runs actual ES modules with mocked Supabase/DOM boundaries; no live data writes.
// Run: node --experimental-vm-modules --test tests/account-request-workflow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
async function loadModule(file, stubs = {}, globals = {}) {
  const context = createContext({ crypto: { randomUUID }, console, ...globals });
  const cache = new Map();
  async function get(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const relative = url.href.slice(root.href.length);
    const stub = stubs[relative];
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

function backend({ insertError = null, status = 201, uploadError = null, cleanupError = null } = {}) {
  const calls = { uploaded: [], removed: [], inserted: [], signed: [], rpc: [] };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner-id' } } }) },
    storage: { from: bucket => ({
      upload: async (path, file, options) => {
        calls.uploaded.push({ bucket, path, file, options });
        return { error: uploadError };
      },
      remove: async paths => { calls.removed.push(...paths); return { error: cleanupError }; },
      createSignedUrl: async (path, seconds, options) => {
        calls.signed.push({ bucket, path, seconds, options });
        return { data: { signedUrl: `https://example.supabase.co/signed/${path}` }, error: null };
      }
    }) },
    from: table => ({ insert: rows => {
      assert.equal(table, 'requests');
      calls.inserted.push(...rows);
      return { select: () => ({ single: async () => ({ data: rows[0], error: insertError, status }) }) };
    } }),
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: { status: 'success' }, error: null }; }
  };
  return { supabase, calls };
}
const file = (name = 'letter.docx', type = '', size = 123) => new File([new Uint8Array(size)], name, { type });
const configStub = supabase => ({ 'src/config/supabase.js': { supabase } });

test('account creation sends the chosen role and rejects forged roles', async () => {
  const { supabase, calls } = backend();
  const { UserService } = await loadModule('src/services/user.service.js', configStub(supabase));
  await UserService.createAccount('admin@example.com', 'New Admin', 'StrongPassword123!', 'admin');
  await UserService.createAccount('staff@example.com', 'Personnel', 'StrongPassword123!');
  assert.equal(calls.rpc[0].args.user_role, 'admin');
  assert.equal(calls.rpc[1].args.user_role, 'personnel');
  await assert.rejects(UserService.createAccount('x', 'x', 'x', 'super_admin'), /Choose Personnel or Admin/);
  assert.equal(calls.rpc.length, 2);
});

test('optional request details become NULL and do not require an attachment', async () => {
  const { supabase, calls } = backend();
  const { RequestsService } = await loadModule('src/services/requests.service.js', configStub(supabase));
  await RequestsService.createRequest('seed-id', 0.5, { purpose: ' ', planting_site: '', contact_number: ' ' });
  assert.equal(calls.inserted[0].purpose, null);
  assert.equal(calls.inserted[0].planting_site, null);
  assert.equal(calls.inserted[0].contact_number, null);
  assert.equal(calls.inserted[0].status, 'PENDING');
  assert.equal(calls.uploaded.length, 0);
  await assert.rejects(RequestsService.createRequest('seed-id', 0, {}), /valid quantity/);
});

test('all allowed file formats, MIME mismatch, empty files, and the 10 MB boundary', async () => {
  const { RequestLetterService } = await loadModule('src/services/request-letter.service.js', configStub(backend().supabase));
  for (const name of ['letter.PDF', 'letter.JPG', 'letter.jpeg', 'letter.png', 'letter.doc', 'letter.docx']) {
    assert.ok(RequestLetterService.validate(file(name)).contentType);
  }
  assert.ok(RequestLetterService.validate(file('letter.docx', 'application/zip')));
  assert.ok(RequestLetterService.validate(file('letter.doc', 'application/octet-stream')));
  assert.ok(RequestLetterService.validate(file('letter.pdf', 'application/pdf', 10 * 1024 * 1024)));
  assert.throws(() => RequestLetterService.validate(file('letter.docm')), /Choose a PDF/);
  assert.throws(() => RequestLetterService.validate(file('letter.png', 'text/html')), /does not match/);
  assert.throws(() => RequestLetterService.validate(file('letter.pdf', '', 0)), /non-empty/);
  assert.throws(() => RequestLetterService.validate(file('letter.docx', '', 10 * 1024 * 1024 + 1)), /10 MB/);
});

test('Word upload is private, immutable, and linked to exactly the new request', async () => {
  const { supabase, calls } = backend();
  const { RequestsService } = await loadModule('src/services/requests.service.js', configStub(supabase));
  const request = await RequestsService.createRequest('seed-id', 1, {}, file());
  const upload = calls.uploaded[0];
  assert.equal(upload.bucket, 'request-letters');
  assert.ok(upload.path.startsWith(`owner-id/${request.id}/`));
  assert.ok(upload.path.endsWith('.docx'));
  assert.equal(upload.options.upsert, false);
  assert.match(upload.options.contentType, /wordprocessingml/);
  assert.equal(upload.file.type, upload.options.contentType);
  assert.equal(request.request_letter_path, upload.path);
  assert.equal(request.request_letter_name, 'letter.docx');
});

test('the actual Supabase SDK sends generic Office files with the canonical Word MIME type', async () => {
  let multipart;
  const supabase = createClient('https://test.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      multipart = options.body;
      return new Response(JSON.stringify({ Id: randomUUID(), Key: 'request-letters/path' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    } }
  });
  const { RequestLetterService } = await loadModule('src/services/request-letter.service.js', configStub(supabase));
  await RequestLetterService.upload(file('letter.docx', 'application/zip'), 'owner', 'request');
  assert.equal(multipart.get('').type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(multipart.get('').size, 123);
});

test('failed/oversized uploads never insert a request', async () => {
  const { supabase, calls } = backend({ uploadError: { message: 'Upload denied' } });
  const { RequestsService } = await loadModule('src/services/requests.service.js', configStub(supabase));
  await assert.rejects(RequestsService.createRequest('seed', 1, {}, file()), /Upload denied/);
  await assert.rejects(RequestsService.createRequest('seed', 1, {}, file('x.pdf', '', 10485761)), /10 MB/);
  assert.equal(calls.inserted.length, 0);
});

test('database rejection cleans an unlinked upload; uncertain response preserves it', async () => {
  for (const status of [400, 0, 502]) {
    const { supabase, calls } = backend({ status, insertError: new Error('Request denied') });
    const { RequestsService } = await loadModule('src/services/requests.service.js', configStub(supabase));
    const confirmedRejection = status === 400;
    await assert.rejects(RequestsService.createRequest('seed', 1, {}, file()), confirmedRejection ? /Request denied/ : /Refresh My Requests/);
    assert.equal(calls.removed.length, confirmedRejection ? 1 : 0);
  }
});

test('cleanup failures are reported without claiming the request succeeded', async () => {
  const { supabase } = backend({ status: 400, insertError: new Error('Insufficient stock'), cleanupError: new Error('Offline') });
  const { RequestsService } = await loadModule('src/services/requests.service.js', configStub(supabase));
  await assert.rejects(RequestsService.createRequest('seed', 1, {}, file()), /Insufficient stock.*unattached upload/);
});

test('private preview/download URLs expire and preserve the download filename', async () => {
  const { supabase, calls } = backend();
  const { RequestLetterService } = await loadModule('src/services/request-letter.service.js', configStub(supabase));
  await RequestLetterService.getLinks({ request_letter_path: 'owner/request/file.docx', request_letter_name: 'Original letter.docx' });
  assert.equal(calls.signed.length, 2);
  assert.ok(calls.signed.every(call => call.seconds === 600 && call.bucket === 'request-letters'));
  assert.equal(calls.signed[1].options.download, 'Original letter.docx');
});

test('attachment viewer handles empty, image, PDF, and Word files and escapes filenames', async () => {
  let opened;
  const { RequestLetterComponent } = await loadModule('src/components/request-letter.component.js', {
    ...configStub(backend().supabase),
    'src/components/modal.component.js': { ModalComponent: { open: options => { opened = options; } } },
    'src/components/toast.component.js': { ToastComponent: { show() {} } }
  });
  await RequestLetterComponent.open({});
  assert.match(opened.bodyHtml, /No attachment submitted/);
  const links = { preview: 'https://example.com/preview', download: 'https://example.com/download' };
  assert.match(RequestLetterComponent.body({ request_letter_type: 'application/pdf' }, links), /<iframe/);
  assert.match(RequestLetterComponent.body({ request_letter_type: 'image/png' }, links), /<img/);
  const word = RequestLetterComponent.body({ request_letter_type: 'application/msword', request_letter_name: '<img onerror=alert(1)>.doc' }, links);
  assert.match(word, /Word document attached/);
  assert.ok(!word.includes('<iframe') && !word.includes('<img onerror'));
  assert.match(word, /&lt;img/);
});

test('quick request allows blank purpose and repeated binding cannot double-submit', async () => {
  let submissions = 0;
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const submit = { disabled: false };
  const form = { querySelector: () => submit, reset() {} };
  const elements = {
    'quick-request-form': form,
    'quick-request-seed': { value: 'seed' },
    'quick-request-quantity': { value: '1' },
    'quick-request-purpose': { value: '' },
    'quick-request-letter': { files: [file('letter.pdf')] }
  };
  const { PersonnelDashboardPage } = await loadModule('src/pages/personnel/dashboard.page.js', {
    ...configStub(backend().supabase),
    'src/services/seeds.service.js': { SeedsService: { getAvailableQuantity: () => 5 } },
    'src/services/requests.service.js': { RequestsService: { createRequest: async (...args) => {
      submissions++;
      assert.equal(args[2].purpose, '');
      assert.equal(args[3].name, 'letter.pdf');
      await pending;
    } } },
    'src/services/auth.service.js': { AuthService: {} },
    'src/router/router.js': { Router: {} },
    'src/components/toast.component.js': { ToastComponent: { show() {} } }
  }, { document: { getElementById: id => elements[id] } });
  PersonnelDashboardPage.seeds = [{ id: 'seed' }];
  PersonnelDashboardPage.init = async () => PersonnelDashboardPage.bindEvents();
  PersonnelDashboardPage.bindEvents();
  PersonnelDashboardPage.bindEvents();
  const first = form.onsubmit({ preventDefault() {} });
  await form.onsubmit({ preventDefault() {} });
  assert.equal(submissions, 1);
  finish();
  await first;
  assert.equal(submit.disabled, false);
});
