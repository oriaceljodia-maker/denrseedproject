import { RequestsService } from '../../services/requests.service.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';

export const AdminRequestsPage = {
  render() {
    return `
      <div class="admin-container">
        <div style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">Seed Distribution Requests</h1>
          <p style="font-size: 0.875rem; color: var(--text-muted);">Review and process incoming personnel seed allocation requests</p>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Requested By</th>
                  <th>Seed Variety</th>
                  <th>Quantity Requested</th>
                  <th>Purpose</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="requests-table-body">
                <tr><td colspan="7" style="text-align:center;">Loading requests...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.loadRequests();
  },

  async loadRequests() {
    try {
      const requests = await RequestsService.getRequests();
      const tbody = document.getElementById('requests-table-body');

      if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = requests.map(req => {
        const isPending = req.status === 'PENDING';
        return `
          <tr>
            <td><strong>${req.profiles?.full_name || 'Personnel'}</strong><br/><small style="color:var(--text-muted);">${req.profiles?.email || ''}</small></td>
            <td>${req.seeds?.species_name || 'N/A'}</td>
            <td><strong>${req.quantity}</strong> packs</td>
            <td style="max-width: 250px; font-size: 0.8125rem;">${req.purpose || 'N/A'}</td>
            <td>${new Date(req.created_at).toLocaleDateString()}</td>
            <td><span class="badge badge-${req.status.toLowerCase()}">${req.status}</span></td>
            <td>
              ${isPending ? `
                <button class="btn btn-primary btn-approve" data-id="${req.id}" style="padding: 0.25rem 0.625rem; font-size:0.75rem;">Approve</button>
                <button class="btn btn-danger btn-reject" data-id="${req.id}" style="padding: 0.25rem 0.625rem; font-size:0.75rem;">Reject</button>
              ` : `<small style="color:var(--text-muted);">Processed</small>`}
            </td>
          </tr>
        `;
      }).join('');

      this.bindActionButtons();
    } catch (err) {
      ToastComponent.show('Failed to fetch request queue.', 'error');
    }
  },

  bindActionButtons() {
    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reqId = e.currentTarget.getAttribute('data-id');
        ModalComponent.open({
          title: 'Approve Seed Request',
          bodyHtml: '<p>Are you sure you want to approve this request? The quantity will be deducted upon distribution.</p>',
          confirmText: 'Approve Request',
          onConfirm: async () => {
            try {
              await RequestsService.updateRequestStatus(reqId, 'APPROVED');
              ToastComponent.show('Request approved.', 'success');
              await this.loadRequests();
            } catch (err) {
              ToastComponent.show(err.message || 'Approval failed.', 'error');
            }
          }
        });
      });
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reqId = e.currentTarget.getAttribute('data-id');
        ModalComponent.open({
          title: 'Reject Seed Request',
          bodyHtml: `
            <div class="form-group">
              <label for="reject-reason">Reason for Rejection</label>
              <textarea id="reject-reason" class="form-input" rows="3" placeholder="Specify reason..." required></textarea>
            </div>
          `,
          confirmText: 'Reject Request',
          onConfirm: async () => {
            const notes = document.getElementById('reject-reason').value.trim();
            try {
              await RequestsService.updateRequestStatus(reqId, 'REJECTED', notes);
              ToastComponent.show('Request rejected.', 'info');
              await this.loadRequests();
            } catch (err) {
              ToastComponent.show(err.message || 'Rejection failed.', 'error');
            }
          }
        });
      });
    });
  }
};