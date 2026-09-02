import { RequestsService } from '../../services/requests.service.js';
import { ModalComponent } from '../../components/modal.component.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml, escapeAttr } from '../../../utils/formatters.js';
import { MaintenanceService } from '../../services/maintenance.service.js';

export const AdminRequestsPage = {
  allRequests: [],

  render() {
    return `
      <div class="admin-container">
        <div class="catalog-hero" style="margin-bottom: 1.25rem;">
          <div class="eyebrow">Request oversight</div>
          <h1>Seed Distribution Requests</h1>
          <p>Review incoming allocation requests from field personnel and keep restoration operations moving with clear approvals.</p>
        </div>

        <div class="filter-bar" style="margin-bottom: 1rem;">
          <div class="search-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="requests-search" class="form-input" placeholder="Search by requester or species..." />
          </div>
          <select id="requests-status-filter" class="form-input">
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="READY_FOR_RELEASE">Ready for Release</option>
            <option value="REJECTED">Rejected</option>
            <option value="DISBURSED">Disbursed</option>
          </select>
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
    this.bindSearchAndFilter();
  },

  async loadRequests() {
    try {
      this.allRequests = await RequestsService.getRequests();
      this.renderRequests(this.allRequests);
    } catch (err) {
      ToastComponent.show('Failed to fetch request queue.', 'error');
    }
  },

  renderRequests(requests) {
    const tbody = document.getElementById('requests-table-body');

    if (!requests || requests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No requests found.</td></tr>`;
      return;
    }

    tbody.innerHTML = requests.map(req => {
      const isPending = req.status === 'PENDING';
      const isApproved = req.status === 'APPROVED';
      const isReady = req.status === 'READY_FOR_RELEASE';
      return `
        <tr>
          <td><strong>${escapeHtml(req.profiles?.full_name) || 'Personnel'}</strong></td>
          <td>${escapeHtml(req.seeds?.species_name) || 'N/A'}</td>
          <td><strong>${req.quantity}</strong> ${escapeHtml(req.seeds?.unit || 'packs')}</td>
          <td style="max-width: 250px; font-size: 0.8125rem;"><strong>${escapeHtml(req.purpose_category || 'Request')}</strong><br/>${escapeHtml(req.planting_site || 'Location not provided')}<br/>${escapeHtml(req.purpose) || 'N/A'}</td>
          <td>${new Date(req.created_at).toLocaleDateString()}</td>
          <td><span class="badge badge-${escapeHtml(req.status.toLowerCase())}">${escapeHtml(req.status)}</span></td>
          <td>
            ${isPending ? `
              <button class="btn btn-primary btn-approve" data-id="${escapeAttr(req.id)}" style="padding: 0.25rem 0.625rem; font-size:0.75rem;">Approve</button>
              <button class="btn btn-danger btn-reject" data-id="${escapeAttr(req.id)}" style="padding: 0.25rem 0.625rem; font-size:0.75rem;">Reject</button>
            ` : isApproved ? `<button class="btn btn-secondary btn-ready-request" data-id="${escapeAttr(req.id)}" style="padding:0.25rem .625rem;font-size:.75rem;">Mark Ready</button>` : isReady ? `<button class="btn btn-primary btn-release-request" data-id="${escapeAttr(req.id)}" style="padding:0.25rem .625rem;font-size:.75rem;">Mark Released</button>` : `<small style="color:var(--text-muted);">Processed</small>`}
          </td>
        </tr>
      `;
    }).join('');

    this.bindActionButtons();
  },

  bindSearchAndFilter() {
    const searchInput = document.getElementById('requests-search');
    const statusFilter = document.getElementById('requests-status-filter');

    const applyFilters = () => {
      const query = (searchInput?.value || '').toLowerCase().trim();
      const status = statusFilter?.value || '';

      const filtered = this.allRequests.filter(req => {
        const matchesQuery = !query || 
          (req.profiles?.full_name || '').toLowerCase().includes(query) ||
          (req.seeds?.species_name || '').toLowerCase().includes(query) ||
          (req.purpose || '').toLowerCase().includes(query);
        const matchesStatus = !status || req.status === status;
        return matchesQuery && matchesStatus;
      });

      this.renderRequests(filtered);
    };

    searchInput?.addEventListener('input', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
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
              if (await MaintenanceService.isEnabled()) throw new Error('Request decisions are disabled while maintenance mode is active.');
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
              if (await MaintenanceService.isEnabled()) throw new Error('Request decisions are disabled while maintenance mode is active.');
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

    document.querySelectorAll('.btn-ready-request, .btn-release-request').forEach(btn => {
      btn.addEventListener('click', async event => {
        const status = event.currentTarget.classList.contains('btn-ready-request') ? 'READY_FOR_RELEASE' : 'DISBURSED';
        try {
          if (await MaintenanceService.isEnabled()) throw new Error('Request decisions are disabled while maintenance mode is active.');
          await RequestsService.updateRequestStatus(event.currentTarget.getAttribute('data-id'), status);
          ToastComponent.show(status === 'READY_FOR_RELEASE' ? 'Request marked ready for release.' : 'Request marked released.', 'success');
          await this.loadRequests();
        } catch (error) {
          ToastComponent.show(error.message || 'Unable to update request.', 'error');
        }
      });
    });
  }
};
