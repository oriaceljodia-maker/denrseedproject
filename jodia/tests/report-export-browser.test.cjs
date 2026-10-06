// Run from jodia: node tests/report-export-browser.test.cjs PATH_TO_PLAYWRIGHT [PDF_OUTPUT]
// Uses an isolated browser, synthetic report data, and blocks live API calls.
const { chromium } = require(process.argv[2]);
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { dirname, join } = require('node:path');
const { tmpdir } = require('node:os');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5176, strictPort: true } });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
    await context.route('**/*', route => {
      if (!route.request().url().startsWith('http://127.0.0.1:5176/')) return route.abort();
      if (route.request().url().endsWith('/report-harness')) return route.fulfill({ contentType: 'text/html', body: `
        <!doctype html><meta charset="utf-8"><main id="app-root"></main>
        <script>window.ENV={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test-only'};</script>` });
      return route.continue();
    });
    await page.goto('http://127.0.0.1:5176/report-harness');
    await page.evaluate(async () => {
      const { AdminReportsPage } = await import('/src/pages/admin/reports.page.js');
      const { ToastComponent } = await import('/src/components/toast.component.js');
      ToastComponent.show = (message, type) => { window.lastToast = { message, type }; };
      window.report = AdminReportsPage;
      document.getElementById('app-root').innerHTML = AdminReportsPage.render();
      const source = 'Talipan Nursery & Coastal Projects';
      const seeds = Array.from({ length: 12 }, (_, index) => ({
        id: `seed-${index}`, species_name: ['Narra', 'Banaba', 'Molave'][index % 3] + ` (Seed lot ${index + 1})`,
        scientific_name: ['Pterocarpus indicus', 'Lagerstroemia speciosa', 'Vitex parviflora'][index % 3],
        category: 'Indigenous Tree', source_location: source,
        quantity: index % 3 === 0 ? 25.5 : index % 3 === 1 ? 4 : 0,
        reserved_quantity: index % 3 === 0 ? 2.5 : 0, reorder_level: 5, unit: index % 2 ? 'kg' : 'g',
        seedlot_no: `DENR-TAL-2026-${index + 1}`, ipt_no: `IPT-${index + 1}`,
        collectors: 'Field Personnel Team', date_collected: '2026-09-20', processing_status: 'Processed / Ready'
      }));
      const statuses = ['PENDING', 'APPROVED', 'READY_FOR_RELEASE', 'RELEASED', 'REJECTED', 'CANCELLED'];
      const requests = Array.from({ length: 24 }, (_, index) => ({
        id: `request-${index}`, seed_id: seeds[index % seeds.length].id, seeds: seeds[index % seeds.length],
        profiles: { full_name: `Demo Personnel ${index + 1}` }, quantity: index % 2 ? 0.5 : 2,
        purpose_category: index % 2 ? 'Nursery Propagation' : 'Reforestation',
        created_at: '2026-10-05T10:30:00Z', needed_date: '2026-10-20', status: statuses[index % statuses.length],
        review_notes: index % 6 === 4 ? 'Incomplete supporting details; please resubmit.' : 'Demonstration record.'
      }));
      AdminReportsPage.data = { seeds, requests };
      AdminReportsPage.populateFilters();
      document.getElementById('report-source-filter').value = source;
      AdminReportsPage.bindEvents();
      AdminReportsPage.renderData();
      window.downloads = [];
      AdminReportsPage.downloadFile = (name, content, type) => window.downloads.push({ name, content, type });
      // Keep the real print document; intercept only the operating-system dialog.
      window.originalOpen = window.open.bind(window);
      window.open = () => {
        const popup = window.originalOpen('', '_blank', 'width=1100,height=800');
        if (popup) popup.print = () => { popup.printCalled = true; };
        return popup;
      };
    });
    assert.equal(await page.locator('.report-actions button').count(), 2);
    assert.equal(await page.locator('#report-csv').count(), 0);
    assert.equal(await page.locator('#report-pdf').textContent(), 'Export PDF');
    assert.equal(await page.locator('#report-pdf').evaluate(button => button.classList.contains('btn-primary')), true);
    await page.locator('#report-excel').click();
    assert.equal(await page.evaluate(() => window.downloads.length), 1);
    assert.match(await page.evaluate(() => window.downloads[0].content), /ss:Name="Request History"/);
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#report-pdf').click();
    const popup = await popupPromise;
    await popup.waitForFunction(() => window.printCalled === true);
    await popup.emulateMedia({ media: 'print' });
    assert.equal(await popup.locator('h1').count(), 1);
    assert.equal(await popup.locator('.report-actions, .report-filters, button').count(), 0);
    assert.match(await popup.locator('.report-filters-summary').textContent(), /Talipan Nursery & Coastal Projects/);
    assert.equal(await popup.locator('.stats-grid .stat-card').count(), 5);
    assert.equal(await popup.locator('#report-requests tr').count(), 24);
    assert.equal(await popup.locator('#report-requests').evaluate(body => body.closest('table').querySelectorAll('th').length), 7);
    assert.equal(await popup.locator('th').first().evaluate(header => getComputedStyle(header).printColorAdjust), 'exact');
    assert.equal(await popup.locator('.print-help').isVisible(), false);
    assert.equal(await popup.evaluate(() => [...document.querySelectorAll('table')].every(table => table.getBoundingClientRect().right <= document.documentElement.clientWidth)), true);
    const path = process.argv[3] || join(tmpdir(), 'denr-report-preview.pdf');
    await mkdir(dirname(path), { recursive: true });
    // Deliberately disable printBackground: exact color adjustment must retain
    // the report colors even with Chromium's default background suppression.
    await popup.pdf({ path, preferCSSPageSize: true, printBackground: false });
    await popup.close();
    await page.evaluate(() => {
      window.report.data = { seeds: [], requests: [] };
      window.report.renderData();
    });
    const emptyPromise = page.waitForEvent('popup');
    await page.locator('#report-pdf').click();
    const emptyPopup = await emptyPromise;
    await emptyPopup.waitForFunction(() => window.printCalled === true);
    assert.equal(await emptyPopup.locator('#report-requests td').getAttribute('colspan'), '7');
    assert.match(await emptyPopup.locator('#report-inventory').textContent(), /No inventory records/);
    await emptyPopup.close();
    await page.evaluate(() => {
      window.open = () => null;
      window.report.printReport();
    });
    assert.equal(await page.evaluate(() => window.lastToast.type), 'error');
    assert.match(await page.evaluate(() => window.lastToast.message), /Allow pop-ups/);
    assert.deepEqual(errors, []);
    console.log('PASS: two export buttons, unchanged Excel workbook, filtered PDF contents, exact print colors, print-only layout, and popup-blocked feedback. Saved synthetic PDF:', path);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error.message); process.exit(1); });
