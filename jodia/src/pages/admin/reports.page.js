import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const AdminReportsPage = {
  data: null,

  render() {
    return `<div class="admin-container reports-page"><div class="page-header"><div><div class="eyebrow">Reports & logs</div><h1 class="page-title">Inventory Analytics & Request History</h1><p class="page-subtitle">A live summary of inventory health and submitted seed requests.</p></div><div class="report-actions"><button class="btn btn-secondary" id="report-print">Print</button><button class="btn btn-danger" id="report-pdf">PDF</button></div></div><section class="stats-grid" id="report-summary"></section><section class="card"><h2 class="section-title">Inventory Analytics</h2><div class="table-container"><table class="data-table"><thead><tr><th>Seed</th><th>Stock</th><th>Status</th><th>Requests</th></tr></thead><tbody id="report-inventory"></tbody></table></div></section><section class="card"><h2 class="section-title">Request History</h2><div class="table-container"><table class="data-table"><thead><tr><th>Personnel</th><th>Seed</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead><tbody id="report-requests"></tbody></table></div></section></div>`;
  },

  async init() {
    try {
      const [seeds, requests] = await Promise.all([SeedsService.getAllSeeds(), RequestsService.getRequests()]);
      this.data = { seeds, requests };
      this.renderData();
      document.getElementById('report-print')?.addEventListener('click', () => this.printReport(false));
      document.getElementById('report-pdf')?.addEventListener('click', () => this.printReport(true));
    } catch (error) { ToastComponent.show('Failed to load reports.', 'error'); }
  },

  renderData() {
    const { seeds, requests } = this.data;
    const totalUnits = seeds.reduce((sum, seed) => sum + (seed.quantity || 0), 0);
    const outOfStock = seeds.filter(seed => seed.quantity <= 0).length;
    document.getElementById('report-summary').innerHTML = `<div class="stat-card"><div class="stat-title">Total Seeds</div><div class="stat-value">${seeds.length}</div></div><div class="stat-card"><div class="stat-title">Total Units</div><div class="stat-value">${totalUnits}</div></div><div class="stat-card"><div class="stat-title">Out of Stock</div><div class="stat-value">${outOfStock}</div></div><div class="stat-card"><div class="stat-title">Total Requests</div><div class="stat-value">${requests.length}</div></div>`;
    const requestCount = requests.reduce((map, request) => (map.set(request.seed_id, (map.get(request.seed_id) || 0) + 1), map), new Map());
    document.getElementById('report-inventory').innerHTML = seeds.map(seed => { const status = seed.quantity <= 0 ? 'Out of Stock' : seed.quantity <= seed.reorder_level ? 'Low Stock' : 'Available'; return `<tr><td><strong>${escapeHtml(seed.species_name)}</strong></td><td>${seed.quantity}</td><td>${status}</td><td>${requestCount.get(seed.id) || 0}</td></tr>`; }).join('') || '<tr><td colspan="4">No seed records found.</td></tr>';
    document.getElementById('report-requests').innerHTML = requests.slice(0, 20).map(request => `<tr><td>${escapeHtml(request.profiles?.full_name) || 'Personnel'}</td><td>${escapeHtml(request.seeds?.species_name) || 'N/A'}</td><td>${request.quantity}</td><td>${escapeHtml(request.status)}</td><td>${new Date(request.created_at).toLocaleDateString()}</td></tr>`).join('') || '<tr><td colspan="5">No requests found.</td></tr>';
  },

  printReport(preferPdf) {
    if (!this.data) return;
    const report = document.querySelector('.reports-page').cloneNode(true);
    report.querySelector('.report-actions')?.remove();
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) return ToastComponent.show('Allow pop-ups to print the report.', 'error');
    popup.document.write(`<!doctype html><html><head><title>DENR Seed Inventory Report</title><style>body{font-family:Arial,sans-serif;color:#102d4c;padding:30px}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin:15px 0 28px}th{background:#137a38;color:white;text-align:left}th,td{padding:9px;border:1px solid #dce5df;font-size:12px}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.stat-card{border:1px solid #dce5df;padding:12px;border-radius:7px}.stat-title{font-size:11px}.stat-value{font-size:23px;font-weight:bold;margin-top:5px}.eyebrow{font-size:11px;color:#137a38;text-transform:uppercase;font-weight:bold}.page-subtitle{color:#536b83}@media print{body{padding:0}}</style></head><body><h1>DENR TALIPAN — SEED INVENTORY REPORT</h1><p>Generated: ${new Date().toLocaleString()}${preferPdf ? ' — Select “Save as PDF” as the print destination.' : ''}</p>${report.innerHTML}</body></html>`);
    popup.document.close(); popup.focus(); popup.print();
  }
};
