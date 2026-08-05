import { RequestsService } from '../../services/requests.service.js';
import { AuthService } from '../../services/auth.service.js';
import { ToastComponent } from '../../components/toast.component.js';

export const PersonnelMyRequestsPage = {
  render() {
    return `
      <div class="catalog-container">
        <div style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">My Seed Requests</h1>
          <p style="font-size: 0.875rem; color: var(--text-muted);">Track real-time status and review feedback for requested seeds</p>
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
      const requests = await RequestsService.getRequests(currentUser.id);
      const tbody = document.getElementById('my-requests-table-body');

      if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">You have not submitted any seed requests yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.map(req => `
        <tr>
          <td><strong>${req.seeds?.species_name || 'N/A'}</strong></td>
          <td>${req.quantity} packs</td>
          <td style="max-width: 200px; font-size:0.8125rem;">${req.purpose || 'N/A'}</td>
          <td>${new Date(req.created_at).toLocaleDateString()}</td>
          <td><span class="badge badge-${req.status.toLowerCase()}">${req.status}</span></td>
          <td style="font-size:0.8125rem; color:var(--text-muted);">${req.review_notes || '-'}</td>
        </tr>
      `).join('');
    } catch (err) {
      ToastComponent.show('Failed to fetch request history.', 'error');
    }
  }
};