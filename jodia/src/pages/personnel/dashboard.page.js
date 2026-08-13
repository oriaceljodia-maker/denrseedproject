import { SeedsService } from '../../services/seeds.service.js';
import { RequestsService } from '../../services/requests.service.js';
import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ROUTES } from '../../config/constants.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeAttr, escapeHtml } from '../../../utils/formatters.js';

export const PersonnelDashboardPage = {
  seeds: [],

  render() {
    return `
      <div class="personnel-dashboard catalog-container">
        <div class="page-header">
          <div>
            <div class="eyebrow">Personnel portal</div>
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">Here’s your seed request activity overview.</p>
          </div>
        </div>

        <div class="personnel-dashboard-stats">
          <div class="personnel-stat-card"><span class="personnel-stat-icon seeds">🌱</span><div><span>Available Seeds</span><strong id="dashboard-available-seeds">-</strong><small>Varieties in stock</small></div></div>
          <div class="personnel-stat-card"><span class="personnel-stat-icon requests">▤</span><div><span>My Requests</span><strong id="dashboard-total-requests">-</strong><small>All time</small></div></div>
          <div class="personnel-stat-card"><span class="personnel-stat-icon pending">◷</span><div><span>Pending</span><strong id="dashboard-pending-requests">-</strong><small>Awaiting approval</small></div></div>
        </div>

        <section class="personnel-dashboard-panel">
          <div class="personnel-panel-heading"><h2>My Recent Requests</h2><button class="btn btn-secondary btn-sm" id="dashboard-view-all">View All</button></div>
          <div class="table-container"><table class="data-table"><thead><tr><th>Seed</th><th>Qty</th><th>Date</th><th>Status</th><th>Admin Notes</th></tr></thead><tbody id="dashboard-recent-requests"><tr><td colspan="5" style="text-align:center;">Loading requests...</td></tr></tbody></table></div>
        </section>

        <section class="personnel-dashboard-panel">
          <div class="personnel-panel-heading"><h2>Quick Request</h2></div>
          <div class="quick-request-layout">
            <form id="quick-request-form" class="quick-request-form">
              <div class="form-group"><label for="quick-request-seed">Select Seed *</label><select id="quick-request-seed" class="form-input" required><option value="">-- Choose a seed --</option></select></div>
              <div class="form-group"><label for="quick-request-quantity">Quantity *</label><input id="quick-request-quantity" class="form-input" type="number" min="1" placeholder="e.g., 10" required /></div>
              <div class="form-group"><label for="quick-request-purpose">Notes / Purpose</label><textarea id="quick-request-purpose" class="form-input" rows="4" placeholder="e.g., For reforestation project in Barangay..."></textarea></div>
              <button class="btn btn-primary" type="submit">Submit Request</button>
            </form>
            <aside class="quick-request-help"><h3>How it works</h3><ol><li>Select a seed variety from the dropdown.</li><li>Enter the quantity you need.</li><li>Add purpose or project notes.</li><li>Submit—an admin will review the request.</li></ol><p>✓ Requests are reviewed within 1–3 business days.</p></aside>
          </div>
        </section>
      </div>
    `;
  },

  async init() {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) return Router.navigate(null);
      const [seeds, requests] = await Promise.all([SeedsService.getAllSeeds(), RequestsService.getRequests(user.id)]);
      this.seeds = seeds;
      this.renderDashboard(seeds, requests);
      this.bindEvents();
    } catch (err) {
      ToastComponent.show('Failed to load your dashboard.', 'error');
    }
  },

  renderDashboard(seeds, requests) {
    const availableSeeds = seeds.filter(seed => seed.quantity > 0);
    document.getElementById('dashboard-available-seeds').textContent = availableSeeds.length;
    document.getElementById('dashboard-total-requests').textContent = requests.length;
    document.getElementById('dashboard-pending-requests').textContent = requests.filter(request => request.status === 'PENDING').length;

    document.getElementById('quick-request-seed').innerHTML = '<option value="">-- Choose a seed --</option>' + availableSeeds.map(seed => `<option value="${escapeAttr(seed.id)}">${escapeHtml(seed.species_name)} (${seed.quantity} packs)</option>`).join('');
    const tbody = document.getElementById('dashboard-recent-requests');
    const recentRequests = requests.slice(0, 5);
    tbody.innerHTML = recentRequests.length ? recentRequests.map(request => `<tr><td><strong>${escapeHtml(request.seeds?.species_name) || 'N/A'}</strong></td><td>${request.quantity} packs</td><td>${new Date(request.created_at).toLocaleDateString()}</td><td><span class="badge badge-${escapeAttr(request.status.toLowerCase())}">${escapeHtml(request.status)}</span></td><td>${escapeHtml(request.review_notes) || '-'}</td></tr>`).join('') : '<tr><td colspan="5" class="dashboard-empty">No requests yet. Submit a quick request below.</td></tr>';
  },

  bindEvents() {
    document.getElementById('dashboard-view-all')?.addEventListener('click', async () => {
      await Router.navigate(await AuthService.getCurrentUser(), ROUTES.PERSONNEL_REQUESTS);
    });
    document.getElementById('quick-request-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const seedId = document.getElementById('quick-request-seed').value;
      const quantity = Number.parseInt(document.getElementById('quick-request-quantity').value, 10);
      const purpose = document.getElementById('quick-request-purpose').value.trim();
      if (!seedId || !quantity) return ToastComponent.show('Select a seed and enter a valid quantity.', 'error');
      try {
        await RequestsService.createRequest(seedId, quantity, purpose);
        ToastComponent.show('Request submitted for approval.', 'success');
        await this.init();
      } catch (err) {
        ToastComponent.show(err.message || 'Failed to submit request.', 'error');
      }
    });
  }
};
