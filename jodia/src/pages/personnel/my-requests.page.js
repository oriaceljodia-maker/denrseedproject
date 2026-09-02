import { RequestsService } from '../../services/requests.service.js';
import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ROUTES } from '../../config/constants.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';
import { SeedsService } from '../../services/seeds.service.js';

export const PersonnelMyRequestsPage = {
  render() {
    return `
      <div class="catalog-container">
        <div class="page-header">
          <div>
            <div class="eyebrow">Personnel portal</div>
            <h1 class="page-title">My Seed Requests</h1>
            <p class="page-subtitle">Track every request, review approval decisions, and keep your field program aligned with available stock.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="view-catalog-button">Browse Seed Catalog</button>
          </div>
        </div>

        <div class="request-summary">
          <div class="request-summary-card">
            <span>Total Requests</span>
            <strong id="summary-total">-</strong>
          </div>
          <div class="request-summary-card">
            <span>Pending</span>
            <strong id="summary-pending" class="status-warning">-</strong>
          </div>
          <div class="request-summary-card">
            <span>Approved</span>
            <strong id="summary-approved" class="status-success">-</strong>
          </div>
          <div class="request-summary-card">
            <span>Rejected</span>
            <strong id="summary-rejected" class="status-danger">-</strong>
          </div>
        </div>

        <div class="card personnel-notifications"><h2 class="section-title">My Notifications</h2><div id="my-notifications-list">Loading notifications...</div></div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Requested Species</th>
                  <th>Quantity</th>
                  <th>Request Details</th>
                  <th>Date Requested</th>
                  <th>Status</th>
                  <th>Progress & Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="my-requests-table-body">
                <tr><td colspan="7" style="text-align:center;">Loading request history...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  bindGlobalActions() {
    document.getElementById('view-catalog-button')?.addEventListener('click', async () => {
      const currentUser = await AuthService.getCurrentUser();
      await Router.navigate(currentUser, ROUTES.PERSONNEL_CATALOG);
    });
  },

  async init() {
    try {
      this.bindGlobalActions();
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        ToastComponent.show('Session expired. Please log in again.', 'error');
        await Router.navigate(null);
        return;
      }
      const [requests, seeds] = await Promise.all([RequestsService.getRequests(currentUser.id), SeedsService.getAllSeeds()]);
      const tbody = document.getElementById('my-requests-table-body');

      // Update summary cards
      const pendingCount = requests.filter(r => r.status === 'PENDING').length;
      const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
      const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

      document.getElementById('summary-total').textContent = requests.length;
      document.getElementById('summary-pending').textContent = pendingCount;
      document.getElementById('summary-approved').textContent = approvedCount;
      document.getElementById('summary-rejected').textContent = rejectedCount;

      if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">You have not submitted any seed requests yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.map(req => `
        <tr>
          <td><strong>${escapeHtml(req.seeds?.species_name) || 'N/A'}</strong></td>
          <td>${req.quantity} ${escapeHtml(req.seeds?.unit || 'packs')}</td>
          <td style="max-width: 200px; font-size:0.8125rem;"><strong>${escapeHtml(req.purpose_category || 'Request')}</strong><br/>${escapeHtml(req.planting_site || 'Location not provided')}<br/><span style="color:var(--text-muted);">${escapeHtml(req.purpose) || 'No additional purpose provided'}</span></td>
          <td>${new Date(req.created_at).toLocaleDateString()}</td>
          <td><span class="badge badge-${escapeHtml(req.status.toLowerCase())}">${escapeHtml(req.status.replaceAll('_', ' '))}</span></td>
          <td style="font-size:0.8125rem;"><div class="request-timeline">${RequestsService.getTimeline(req.status).map(step => `<span class="${step.complete ? 'complete' : ''}">${escapeHtml(step.label)}</span>`).join('')}</div>${req.review_notes ? `<div class="request-admin-note"><strong>Admin note:</strong> ${escapeHtml(req.review_notes)}</div>` : ''}</td>
          <td>${req.status === 'DISBURSED' ? `<button class="btn btn-secondary btn-request-again" data-id="${req.id}" style="font-size:.75rem;padding:.35rem .55rem;">Request Again</button>` : '—'}</td>
        </tr>
      `).join('');
      this.renderNotifications(requests, seeds);
      this.requests = requests;
      this.bindRequestAgain();
    } catch (err) {
      ToastComponent.show('Failed to fetch request history.', 'error');
    }
  }
  ,
  renderNotifications(requests, seeds = []) {
    const container = document.getElementById('my-notifications-list');
    const notices = requests.filter(request => ['APPROVED', 'REJECTED', 'READY_FOR_RELEASE', 'DISBURSED'].includes(request.status)).slice(0, 4)
      .map(request => `<p class="personnel-notice"><strong>${escapeHtml(request.seeds?.species_name || 'Seed request')}</strong> — ${escapeHtml(request.status.replaceAll('_', ' ').toLowerCase())}${request.review_notes ? `: ${escapeHtml(request.review_notes)}` : ''}</p>`);
    const stockNotices = seeds.filter(seed => SeedsService.getStockStatus(seed).key !== 'in-stock').slice(0, 2)
      .map(seed => `<p class="personnel-notice"><strong>${escapeHtml(seed.species_name)}</strong> — ${escapeHtml(SeedsService.getStockStatus(seed).label)} (${escapeHtml(SeedsService.formatQuantity(seed))} available)</p>`);
    const allNotices = [...notices, ...stockNotices];
    container.innerHTML = allNotices.length ? allNotices.join('') : '<p style="color:var(--text-muted);">No new request or stock updates.</p>';
  },
  bindRequestAgain() {
    document.querySelectorAll('.btn-request-again').forEach(button => button.addEventListener('click', async () => {
      const request = this.requests.find(item => item.id === button.dataset.id);
      if (request) sessionStorage.setItem('denrRepeatRequest', JSON.stringify({ seedId: request.seed_id, quantity: request.quantity, planting_site: request.planting_site || '', needed_date: request.needed_date || '', purpose_category: request.purpose_category || 'Reforestation', beneficiaries_count: request.beneficiaries_count || '', contact_number: request.contact_number || '', purpose: request.purpose || '' }));
      const currentUser = await AuthService.getCurrentUser();
      await Router.navigate(currentUser, ROUTES.PERSONNEL_CATALOG);
    }));
  }
};
