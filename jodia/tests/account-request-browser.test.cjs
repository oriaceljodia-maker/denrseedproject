// Pass the local Playwright package directory as argv[2]. Starts a temporary
// Vite server and uses an isolated headless Chrome with mocked
// Supabase boundaries; no requests to the live database are allowed.
const { chromium } = require(process.argv[2]);
const assert = require('node:assert/strict');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5175, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (!route.request().url().startsWith('http://127.0.0.1:5175/')) return route.abort();
      if (route.request().url().endsWith('/feature-harness')) return route.fulfill({ contentType: 'text/html', body: `
        <!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/styles/base.css"><link rel="stylesheet" href="/styles/pages/components.css">
        <link rel="stylesheet" href="/styles/pages/admin.css"><link rel="stylesheet" href="/styles/pages/personnel.css">
        <main id="app-root" style="padding:24px"></main><div id="modal-root"></div><div id="toast-root"></div>
        <script>window.ENV={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test-only'};</script>` });
      return route.continue();
    });
    await page.goto('http://127.0.0.1:5175/feature-harness');
    await page.evaluate(async () => {
      const { AdminAccountsPage } = await import('/src/pages/admin/accounts.page.js');
      const { supabase } = await import('/src/config/supabase.js');
      const { ToastComponent } = await import('/src/components/toast.component.js');
      ToastComponent.show = () => {};
      window.accounts = AdminAccountsPage;
      window.accountCalls = [];
      supabase.rpc = async (name, args) => { window.accountCalls.push({ name, args }); return { data: {}, error: null }; };
      AdminAccountsPage.loadAccounts = AdminAccountsPage.loadAccessRequests = async () => {};
      document.getElementById('app-root').innerHTML = AdminAccountsPage.render();
      AdminAccountsPage.bindCreateUser();
    });
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    assert.equal(await page.locator('#new-user-role').inputValue(), 'personnel');
    await page.locator('#new-user-role').selectOption('admin');
    await page.locator('#new-user-email').fill('newadmin@example.com');
    await page.locator('#new-user-fullname').fill('New Admin');
    await page.locator('#new-user-password').fill('TemporaryPassword123!');
    await page.locator('#modal-confirm').click();
    await page.waitForFunction(() => !document.getElementById('modal-confirm'));
    assert.equal(await page.evaluate(() => window.accountCalls[0].args.user_role), 'admin');

    await page.evaluate(async () => {
      const { PersonnelCatalogPage } = await import('/src/pages/personnel/catalog.page.js');
      const { RequestsService } = await import('/src/services/requests.service.js');
      const { MaintenanceService } = await import('/src/services/maintenance.service.js');
      window.requestCalls = [];
      RequestsService.createRequest = async (...args) => { window.requestCalls.push(args); return {}; };
      MaintenanceService.isEnabled = async () => false;
      PersonnelCatalogPage.allSeeds = [{ id: 'seed', species_name: 'Banaba', quantity: 20, reserved_quantity: 0, unit: 'g' }];
      document.getElementById('app-root').innerHTML = '<button class="btn-request" data-id="seed" data-name="Banaba">Request Banaba</button>';
      PersonnelCatalogPage.bindRequestButtons();
    });
    await page.getByRole('button', { name: 'Request Banaba' }).click();
    for (const id of ['req-site', 'req-contact', 'req-purpose', 'req-letter']) {
      assert.equal(await page.locator(`#${id}`).evaluate(element => element.required), false);
    }
    await page.locator('#req-letter').setInputFiles({ name: 'Request letter.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('test letter') });
    await page.locator('#modal-confirm').click();
    await page.waitForFunction(() => !document.getElementById('modal-confirm'));
    assert.equal(await page.evaluate(() => window.requestCalls[0][3].name), 'Request letter.docx');
    assert.equal(await page.evaluate(() => window.requestCalls[0][2].planting_site), '');

    await page.evaluate(async () => {
      const { AdminRequestsPage } = await import('/src/pages/admin/requests.page.js');
      window.adminRequests = AdminRequestsPage;
      document.getElementById('app-root').innerHTML = AdminRequestsPage.render();
      AdminRequestsPage.allRequests = [{ id: 'request', status: 'PENDING', quantity: 1, created_at: new Date().toISOString() }];
      AdminRequestsPage.renderRequests(AdminRequestsPage.allRequests);
    });
    await page.getByRole('button', { name: 'View Request Letter' }).click();
    assert.equal(await page.getByText('No attachment submitted', { exact: true }).isVisible(), true);
    await page.locator('#modal-confirm').click();
    await page.evaluate(async () => {
      const { RequestLetterService } = await import('/src/services/request-letter.service.js');
      RequestLetterService.getLinks = async () => ({ preview: 'http://127.0.0.1:5175/letter.docx', download: 'http://127.0.0.1:5175/letter.docx?download=1' });
      Object.assign(window.adminRequests.allRequests[0], { request_letter_path: 'owner/request/letter.docx', request_letter_name: 'Request letter.docx', request_letter_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    });
    await page.getByRole('button', { name: 'View Request Letter' }).click();
    assert.equal(await page.getByText('Word document attached', { exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('link', { name: 'Download File' }).isVisible(), true);
    assert.equal(await page.locator('.request-letter-card iframe').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => {
      const box = document.querySelector('.modal-content').getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth && box.top >= 0;
    }), true);
    await page.locator('#modal-confirm').click();
    await page.evaluate(() => window.accounts.openCreateUserModal());
    assert.equal(await page.evaluate(() => {
      const box = document.querySelector('.modal-content').getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth;
    }), true);
    assert.deepEqual(errors, []);
    console.log('PASS: Chrome account role selection, optional request fields, Word file selection, admin empty/Word viewers, and mobile modal layout. No browser runtime errors.');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error.message); process.exit(1); });
