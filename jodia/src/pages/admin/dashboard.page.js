import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const AdminDashboardPage = {
  render() {
    return `
      <div class="admin-container">
        <section class="dashboard-hero">
          <div class="hero-copy">
            <span class="eyebrow">Operational dashboard</span>
            <h1 class="hero-title">DENR Seed Control Center</h1>
            <p class="hero-text">Monitor inventory, pending requests, and low-stock alerts from a unified modern admin experience.</p>
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
                <strong>+8.4%</strong>
              </div>
              <div class="graph-line"></div>
            </div>
          </div>
        </section>

        <section class="dashboard-main-grid">
          <div class="card chart-card">
            <div class="section-title">Request activity</div>
            <div class="chart-placeholder">Live trend visualization</div>
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

      document.getElementById('stat-total-seeds').textContent = seeds.length;
      document.getElementById('stat-pending-requests').textContent = requests.filter(r => r.status === 'PENDING').length;
      document.getElementById('stat-low-stock').textContent = seeds.filter(s => s.quantity <= s.reorder_level).length;

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