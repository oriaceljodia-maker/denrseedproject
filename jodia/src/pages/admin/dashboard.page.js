import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { DemandInsightsComponent } from '../../components/demand-insights.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const AdminDashboardPage = {
  render() {
    return `
      <div class="admin-container">
        <section class="dashboard-hero">
          <div class="hero-copy">
            <span class="eyebrow">Operational dashboard</span>
            <h1 class="hero-title">DENR Seed Control Center</h1>
            <p class="hero-text">Monitor inventory, pending requests, and low-stock alerts through a field-focused operations hub for reforestation and conservation teams.</p>
            <div class="hero-badges">
              <span class="hero-badge">Reforestation focused</span>
              <span class="hero-badge">Quick approvals</span>
              <span class="hero-badge">Field-ready insights</span>
            </div>
          </div>
          <div class="hero-card">
            <div class="hero-card-top">
              <div>
                <h2>System health</h2>
                <p>Live metrics powered by inventory and request activity.</p>
              </div>
              <div class="hero-chip">Live</div>
            </div>
            <div class="hero-stats-grid">
              <div>
                <span>Total seed varieties</span>
                <strong id="stat-total-seeds">-</strong>
              </div>
              <div>
                <span>Pending requests</span>
                <strong id="stat-pending-requests">-</strong>
              </div>
              <div>
                <span>Low stock items</span>
                <strong id="stat-low-stock">-</strong>
              </div>
            </div>
            <div class="hero-graph">
              <div class="graph-label">
                <span>Request trend</span>
                <strong id="stat-request-trend">-</strong>
              </div>
              <div class="graph-line"></div>
            </div>
          </div>
        </section>

        <section class="stats-grid">
          <div class="stat-card" style="--stat-icon-color: var(--denr-green-primary);">
            <div class="stat-card-content">
              <div><div class="stat-title">Total Inventory</div><div class="stat-value" id="stat-total-packs">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="m4 8 8 4 8-4M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/></svg></span>
            </div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-warning); --stat-icon-color: var(--status-warning);">
            <div class="stat-card-content">
              <div><div class="stat-title">Approved Requests</div><div class="stat-value" id="stat-approved">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4.5h6v3H9zM8.5 13l2.1 2.1 4.5-4.5"/></svg></span>
            </div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-info); --stat-icon-color: var(--status-info);">
            <div class="stat-card-content">
              <div><div class="stat-title">Total Requests</div><div class="stat-value" id="stat-total-requests">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3.5h7l3 3V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path d="M14 3.5V7h3M9 11h6M9 15h4"/></svg></span>
            </div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-danger); --stat-icon-color: var(--status-danger);">
            <div class="stat-card-content">
              <div><div class="stat-title">Rejected Requests</div><div class="stat-value" id="stat-rejected">-</div></div>
              <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6m0-6-6 6"/></svg></span>
            </div>
          </div>
        </section>

        ${DemandInsightsComponent.render()}

        <section class="dashboard-main-grid">
          <div class="card chart-card">
            <div class="section-title">Request activity</div>
            <div class="chart-placeholder">
              <div>
                <img class="dashboard-visual" src="https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=900&q=80" alt="Forest landscape" />
                <div class="chart-caption">Priority requests and seed movement are visualized to support immediate field coordination and nursery replenishment.</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Recent requests</div>
            <div class="table-container">
              <table class="data-table modern-table">
                <thead>
                  <tr>
                    <th>Requested By</th>
                    <th>Seed Variety</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody id="dashboard-requests-body">
                  <tr><td colspan="5" style="text-align:center;">Loading requests...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    `;
  },

  async init() {
    try {
      const [seeds, requests] = await Promise.all([
        SeedsService.getAllSeeds(),
        RequestsService.getRequests()
      ]);

      const pendingCount = requests.filter(r => r.status === 'PENDING').length;
      const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
      const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;
      const lowStockCount = seeds.filter(s => s.quantity <= s.reorder_level).length;
      const totalPacks = seeds.reduce((sum, s) => sum + (s.quantity || 0), 0);

      document.getElementById('stat-total-seeds').textContent = seeds.length;
      document.getElementById('stat-pending-requests').textContent = pendingCount;
      document.getElementById('stat-low-stock').textContent = lowStockCount;
      document.getElementById('stat-total-packs').textContent = totalPacks;
      document.getElementById('stat-approved').textContent = approvedCount;
      document.getElementById('stat-total-requests').textContent = requests.length;
      document.getElementById('stat-rejected').textContent = rejectedCount;
      DemandInsightsComponent.renderData(requests);

      // Calculate request trend percentage
      const trendEl = document.getElementById('stat-request-trend');
      if (requests.length > 0) {
        const approvedPct = Math.round((approvedCount / requests.length) * 100);
        trendEl.textContent = `${approvedPct}% approved`;
      } else {
        trendEl.textContent = 'No data';
      }

      const tbody = document.getElementById('dashboard-requests-body');
      if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No recent requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.slice(0, 5).map(req => `
        <tr>
          <td>${escapeHtml(req.profiles?.full_name) || 'Personnel'}</td>
          <td>${escapeHtml(req.seeds?.species_name) || 'N/A'}</td>
          <td>${req.quantity ?? '—'}</td>
          <td><span class="badge badge-${escapeHtml((req.status || 'Unknown').toLowerCase())}">${escapeHtml(req.status || 'Unknown')}</span></td>
          <td>${req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Unknown'}</td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Dashboard load error:', err);
      ToastComponent.show('Failed to load dashboard metrics.', 'error');
    }
  }
};
