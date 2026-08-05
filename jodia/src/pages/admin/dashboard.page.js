import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { ToastComponent } from '../../components/toast.component.js';

export const AdminDashboardPage = {
  render() {
    return `
      <div class="admin-container">
        <div style="display:flex; justify-between; align-items:center; margin-bottom: 1.5rem;">
          <div>
            <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">Admin Overview</h1>
            <p style="font-size: 0.875rem; color: var(--text-muted);">Real-time inventory and request status dashboard</p>
          </div>
        </div>

        <!-- Metrics Row -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-title">Total Seed Varieties</div>
            <div class="stat-value" id="stat-total-seeds">-</div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-warning);">
            <div class="stat-title">Pending Requests</div>
            <div class="stat-value" id="stat-pending-requests">-</div>
          </div>
          <div class="stat-card" style="border-left-color: var(--status-danger);">
            <div class="stat-title">Low Stock Items</div>
            <div class="stat-value" id="stat-low-stock">-</div>
          </div>
        </div>

        <!-- Inventory Summary Section -->
        <div class="card">
          <h3 style="margin-bottom: 1rem; color: var(--denr-navy-primary);">Recent System Requests</h3>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Requested By</th>
                  <th>Seed Variety</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Requested Date</th>
                </tr>
              </thead>
              <tbody id="dashboard-requests-body">
                <tr><td colspan="5" style="text-align:center;">Loading requests...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    try {
      const [seeds, requests] = await Promise.all([
        SeedsService.getAllSeeds(),
        RequestsService.getRequests()
      ]);

      // Populate Metrics
      document.getElementById('stat-total-seeds').textContent = seeds.length;
      document.getElementById('stat-pending-requests').textContent = requests.filter(r => r.status === 'PENDING').length;
      document.getElementById('stat-low-stock').textContent = seeds.filter(s => s.quantity <= s.reorder_level).length;

      // Populate Table
      const tbody = document.getElementById('dashboard-requests-body');
      if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No recent requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.slice(0, 5).map(req => `
        <tr>
          <td>${req.profiles?.full_name || 'N/A'}</td>
          <td>${req.seeds?.species_name || 'N/A'}</td>
          <td>${req.quantity}</td>
          <td><span class="badge badge-${req.status.toLowerCase()}">${req.status}</span></td>
          <td>${new Date(req.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');

    } catch (err) {
      ToastComponent.show('Failed to load dashboard metrics.', 'error');
    }
  }
};