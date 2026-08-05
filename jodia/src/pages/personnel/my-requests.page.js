import { RequestsService } from '../../services/requests.service.js';
import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const PersonnelMyRequestsPage = {
  render() {
    return `
      <div class="catalog-container">
        <div class="catalog-hero">
          <div class="eyebrow">Request history</div>
          <h1>My Seed Requests</h1>
          <p>Track every request, review approval decisions, and keep your field program aligned with available stock.</p>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Requested Species</th>
                  <th>Quantity</th>
                  <th>Purpose</th>
                  <th>Date Requested</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody id="my-requests-table-body">
                <tr><td colspan="6" style="text-align:center;">Loading request history...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        ToastComponent.show('Session expired. Please log in again.', 'error');
        await Router.navigate(null);
        return;
      }
      const requests = await RequestsService.getRequests(currentUser.id);
      const tbody = document.getElementById('my-requests-table-body');

      if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">You have not submitted any seed requests yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.map(req => `
        <tr>
          <td><strong>${escapeHtml(req.seeds?.species_name) || 'N/A'}</strong></td>
          <td>${req.quantity} packs</td>
          <td style="max-width: 200px; font-size:0.8125rem;">${escapeHtml(req.purpose) || 'N/A'}</td>
          <td>${new Date(req.created_at).toLocaleDateString()}</td>
          <td><span class="badge badge-${escapeHtml(req.status.toLowerCase())}">${escapeHtml(req.status)}</span></td>
          <td style="font-size:0.8125rem; color:var(--text-muted);">${escapeHtml(req.review_notes) || '-'}</td>
        </tr>
      `).join('');
    } catch (err) {
      ToastComponent.show('Failed to fetch request history.', 'error');
    }
  }
};
