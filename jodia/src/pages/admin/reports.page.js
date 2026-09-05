import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { ModalComponent } from '../../components/modal.component.js';
import { escapeAttr, escapeHtml } from '../../../utils/formatters.js';

export const AdminReportsPage = {
  data: null,

  render() {
    return `<div class="admin-container reports-page"><div class="page-header"><div><div class="eyebrow">Reports & logs</div><h1 class="page-title">Inventory Analytics & Request History</h1><p class="page-subtitle">A live summary of inventory health and submitted seed requests.</p></div><div class="report-actions"><button class="btn btn-secondary" id="report-excel">Export Excel</button><button class="btn btn-danger" id="report-pdf">PDF</button></div></div><section class="stats-grid" id="report-summary"></section><section class="card"><h2 class="section-title">Inventory Analytics</h2><div class="table-container"><table class="data-table"><thead><tr><th>Seed</th><th>Stock</th><th>Status</th><th>Requests</th></tr></thead><tbody id="report-inventory"></tbody></table></div></section><section class="card"><h2 class="section-title">Request History</h2><div class="table-container"><table class="data-table"><thead><tr><th>Requested By</th><th>Seed</th><th>Quantity Requested</th><th>Purpose</th><th>Date Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody id="report-requests"></tbody></table></div></section></div>`;
  },

  async init() {
    try {
      const [seeds, requests] = await Promise.all([SeedsService.getAllSeeds(), RequestsService.getRequests()]);
      this.data = { seeds, requests };
      this.renderData();
      document.getElementById('report-excel')?.addEventListener('click', () => this.downloadExcelReport());
      document.getElementById('report-pdf')?.addEventListener('click', () => this.printReport());
    } catch (error) { ToastComponent.show('Failed to load reports.', 'error'); }
  },

  formatQuantity(request) {
    return `${request.quantity} ${request.seeds?.unit || 'units'}`;
  },

  getStatus(seed) {
    const available = SeedsService.getAvailableQuantity ? SeedsService.getAvailableQuantity(seed) : seed.quantity;
    return available <= 0 ? 'Out of Stock' : available <= seed.reorder_level ? 'Low Stock' : 'Available';
  },

  renderData() {
    const { seeds, requests } = this.data;
    const totalUnits = seeds.reduce((sum, seed) => sum + (Number(seed.quantity) || 0), 0);
    const outOfStock = seeds.filter(seed => this.getStatus(seed) === 'Out of Stock').length;
    document.getElementById('report-summary').innerHTML = `<div class="stat-card"><div class="stat-title">Total Seeds</div><div class="stat-value">${seeds.length}</div></div><div class="stat-card"><div class="stat-title">Total Units</div><div class="stat-value">${totalUnits}</div></div><div class="stat-card"><div class="stat-title">Out of Stock</div><div class="stat-value">${outOfStock}</div></div><div class="stat-card"><div class="stat-title">Total Requests</div><div class="stat-value">${requests.length}</div></div>`;
    const requestCount = requests.reduce((map, request) => (map.set(request.seed_id, (map.get(request.seed_id) || 0) + 1), map), new Map());
    document.getElementById('report-inventory').innerHTML = seeds.map(seed => `<tr><td><strong>${escapeHtml(seed.species_name)}</strong></td><td>${escapeHtml(SeedsService.formatQuantity(seed))}</td><td>${this.getStatus(seed)}</td><td>${requestCount.get(seed.id) || 0}</td></tr>`).join('') || '<tr><td colspan="4">No seed records found.</td></tr>';
    document.getElementById('report-requests').innerHTML = requests.map(request => `<tr><td>${escapeHtml(request.profiles?.full_name || 'Personnel')}</td><td>${escapeHtml(request.seeds?.species_name || 'N/A')}</td><td>${escapeHtml(this.formatQuantity(request))}</td><td>${escapeHtml(request.purpose_category || request.purpose || 'Not specified')}</td><td>${new Date(request.created_at).toLocaleDateString()}</td><td>${escapeHtml(request.status)}</td><td><button class="btn btn-secondary btn-view-report-request" data-id="${escapeAttr(request.id)}" style="font-size:.75rem;padding:.3rem .55rem;">View</button></td></tr>`).join('') || '<tr><td colspan="7">No requests found.</td></tr>';
    this.bindRequestDetails();
  },

  bindRequestDetails() {
    document.querySelectorAll('.btn-view-report-request').forEach(button => button.addEventListener('click', event => {
      const request = this.data?.requests.find(item => item.id === event.currentTarget.dataset.id);
      if (!request) return;
      ModalComponent.open({
        title: 'Request Details',
        bodyHtml: `<div class="request-detail-list"><p><strong>Requested by:</strong> ${escapeHtml(request.profiles?.full_name || 'Personnel')}</p><p><strong>Seed:</strong> ${escapeHtml(request.seeds?.species_name || 'N/A')}</p><p><strong>Quantity:</strong> ${escapeHtml(this.formatQuantity(request))}</p><p><strong>Purpose:</strong> ${escapeHtml(request.purpose_category || request.purpose || 'Not specified')}</p><p><strong>Planting site:</strong> ${escapeHtml(request.planting_site || 'Not provided')}</p><p><strong>Date submitted:</strong> ${new Date(request.created_at).toLocaleString()}</p><p><strong>Status:</strong> ${escapeHtml(request.status)}</p><p><strong>Admin note:</strong> ${escapeHtml(request.review_notes || 'None')}</p></div>`,
        confirmText: 'Close',
        cancelText: null,
        onConfirm: () => {}
      });
    }));
  },

  downloadExcelReport() {
    if (!this.data) return;
    const xmlEscape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const cell = value => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
    const row = values => `<Row>${values.map(cell).join('')}</Row>`;
    const { seeds, requests } = this.data;
    const inventoryRows = seeds.map(seed => row([seed.species_name, SeedsService.formatQuantity(seed), this.getStatus(seed)]));
    const requestRows = requests.map(request => row([request.profiles?.full_name || 'Personnel', request.seeds?.species_name || 'N/A', this.formatQuantity(request), request.purpose_category || request.purpose || 'Not specified', new Date(request.created_at).toLocaleDateString(), request.status, request.review_notes || '']));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Inventory"><Table>${row(['Seed', 'Current Stock', 'Status'])}${inventoryRows.join('')}</Table></Worksheet><Worksheet ss:Name="Request History"><Table>${row(['Requested By', 'Seed', 'Quantity Requested', 'Purpose', 'Date Submitted', 'Status', 'Admin Note'])}${requestRows.join('')}</Table></Worksheet></Workbook>`;
    const blob = new Blob([workbook], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `denr-seed-inventory-report-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    ToastComponent.show('Excel report downloaded.', 'success');
  },

  printReport() {
    if (!this.data) return;
    const report = document.querySelector('.reports-page').cloneNode(true);
    report.querySelector('.report-actions')?.remove();
    report.querySelectorAll('.btn-view-report-request').forEach(button => button.replaceWith(document.createTextNode('View in system')));
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) return ToastComponent.show('Allow pop-ups to create the PDF.', 'error');
    popup.document.write(`<!doctype html><html><head><title>DENR Seed Inventory Report</title><style>body{font-family:Arial,sans-serif;color:#102d4c;padding:30px}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin:15px 0 28px}th{background:#137a38;color:white;text-align:left}th,td{padding:9px;border:1px solid #dce5df;font-size:12px}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.stat-card{border:1px solid #dce5df;padding:12px;border-radius:7px}.stat-title{font-size:11px}.stat-value{font-size:23px;font-weight:bold;margin-top:5px}.eyebrow{font-size:11px;color:#137a38;text-transform:uppercase;font-weight:bold}.page-subtitle{color:#536b83}@media print{body{padding:0}}</style></head><body><h1>DENR TALIPAN — SEED INVENTORY REPORT</h1><p>Generated: ${new Date().toLocaleString()} — Select “Save as PDF” as the print destination.</p>${report.innerHTML}</body></html>`);
    popup.document.close(); popup.focus(); popup.print();
  }
};
