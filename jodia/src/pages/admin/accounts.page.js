import { UserService } from '../../services/user.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { ModalComponent } from '../../components/modal.component.js';
import { escapeHtml } from '../../../utils/formatters.js';
import { AccessRequestService } from '../../services/access-request.service.js';

export const AdminAccountsPage = {
  selectedAccessRequestId: null,
  render() {
    return `
      <div class="admin-container accounts-page">
        <div style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">Personnel User Accounts</h1>
          <div class="accounts-page-heading">
            <p style="font-size: 0.875rem; color: var(--text-muted);">Manage registered personnel, roles, and status controls</p>
            <button id="btn-open-create-user" class="btn btn-primary">Create Personnel Account</button>
          </div>
        </div>

      <section class="card accounts-section">
        <div class="section-block">
          <h2 class="section-title">Pending access requests</h2>
          <p>Requests submitted from the public Get Access form. Use the details to create an account, then mark the request approved.</p>
          <div class="table-container"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Requested</th><th>Actions</th></tr></thead><tbody id="access-requests-table-body"><tr><td colspan="4" style="text-align:center;">Loading access requests...</td></tr></tbody></table></div>
        </div>
      </section>

      <section class="card accounts-section">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Role</th>
                <th>Password Status</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="accounts-table-body">
              <tr><td colspan="5" style="text-align:center;">Loading personnel accounts...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    `;
  },

  async init() {
    await this.loadAccounts();
    await this.loadAccessRequests();
    this.bindCreateUser();
  },

  async loadAccessRequests() {
    const tbody = document.getElementById('access-requests-table-body');
    try {
      const requests = await AccessRequestService.getPending();
      if (!requests.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No pending access requests.</td></tr>';
        return;
      }
      tbody.innerHTML = requests.map(request => `<tr>
        <td>${escapeHtml(request.full_name || 'Not provided')}</td>
        <td>${escapeHtml(request.email)}</td>
        <td>${new Date(request.created_at).toLocaleDateString()}</td>
        <td><button class="btn btn-secondary btn-use-access-request" data-id="${escapeHtml(request.id)}" data-email="${escapeHtml(request.email)}" data-name="${escapeHtml(request.full_name || '')}" style="font-size:.75rem;padding:.3rem .55rem;">Create account</button> <button class="btn btn-danger btn-decline-access-request" data-id="${escapeHtml(request.id)}" style="font-size:.75rem;padding:.3rem .55rem;">Decline</button></td>
      </tr>`).join('');
      this.bindAccessRequestButtons();
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Unable to load access requests.</td></tr>';
    }
  },

  bindAccessRequestButtons() {
    document.querySelectorAll('.btn-use-access-request').forEach(button => button.addEventListener('click', event => {
      const target = event.currentTarget;
      this.selectedAccessRequestId = target.dataset.id;
      this.openCreateUserModal({ email: target.dataset.email, fullName: target.dataset.name });
    }));
    document.querySelectorAll('.btn-decline-access-request').forEach(button => button.addEventListener('click', async event => {
      try {
        await AccessRequestService.updateStatus(event.currentTarget.dataset.id, 'DECLINED');
        ToastComponent.show('Access request declined.', 'info');
        await this.loadAccessRequests();
      } catch (error) {
        ToastComponent.show(error.message || 'Unable to update request.', 'error');
      }
    }));
  },

  async createUser({ email, fullName, password }) {
    if (!email || !fullName || password.length < 12) {
      ToastComponent.show('Email, full name, and a temporary password of at least 12 characters are required.', 'error');
      return false;
    }

    try {
      await UserService.createPersonnelAccount(email, fullName, password);
      if (this.selectedAccessRequestId) {
        await AccessRequestService.updateStatus(this.selectedAccessRequestId, 'APPROVED');
        this.selectedAccessRequestId = null;
      }
      ToastComponent.show('Personnel account created. Give the temporary password to the user through an approved secure channel.', 'success');
      await this.loadAccounts();
      await this.loadAccessRequests();
      return true;
    } catch (err) {
      ToastComponent.show(err.message || 'Failed to create the account.', 'error');
      return false;
    }
  },

  bindCreateUser() {
    document.getElementById('btn-open-create-user')?.addEventListener('click', () => {
      this.selectedAccessRequestId = null;
      this.openCreateUserModal();
    });
  },

  openCreateUserModal({ email = '', fullName = '' } = {}) {
    ModalComponent.open({
      title: 'Create New Personnel Account',
      bodyHtml: `
        <p class="modal-intro">Create a personnel account with a strong temporary password. The user will be required to change it after signing in.</p>
        <div class="form-row">
          <div class="form-group"><label for="new-user-email">Email address</label><input type="email" id="new-user-email" class="form-input" value="${escapeHtml(email)}" placeholder="email@denr.gov.ph" required /></div>
          <div class="form-group"><label for="new-user-fullname">Full name</label><input type="text" id="new-user-fullname" class="form-input" value="${escapeHtml(fullName)}" placeholder="Juan Dela Cruz" required /></div>
        </div>
        <div class="form-group"><label for="new-user-password">Temporary password</label><input type="password" id="new-user-password" class="form-input" minlength="12" placeholder="At least 12 characters" required /></div>
      `,
      confirmText: 'Create Account',
      confirmClass: 'btn-primary',
      onConfirm: () => this.createUser({
        email: document.getElementById('new-user-email')?.value.trim() || '',
        fullName: document.getElementById('new-user-fullname')?.value.trim() || '',
        password: document.getElementById('new-user-password')?.value || ''
      })
    });
  },

  async loadAccounts() {
    try {
      const users = await UserService.getAllUsers();
      const tbody = document.getElementById('accounts-table-body');

      if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No user records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = users.map(u => `
        <tr>
          <td><strong>${escapeHtml(u.full_name)}</strong></td>
          <td><span class="badge badge-${escapeHtml(u.role)}">${escapeHtml(u.role)}</span></td>
          <td>
            ${u.requires_password_change ? 
              '<span style="color:var(--status-warning); font-weight:600;">Pending Setup</span>' : 
              '<span style="color:var(--status-success); font-weight:600;">Active Password</span>'}
          </td>
          <td>
            ${u.is_active ? 
              '<span class="badge badge-approved">Active</span>' : 
              '<span class="badge badge-rejected">Disabled</span>'}
          </td>
          <td>
            <button class="btn btn-secondary btn-toggle-status" data-id="${escapeHtml(u.id)}" data-name="${escapeHtml(u.full_name)}" data-active="${u.is_active}" style="color: var(--denr-navy-primary); border-color: var(--border-color); font-size:0.75rem; padding: 0.25rem 0.5rem;">
              ${u.is_active ? 'Disable Account' : 'Enable Account'}
            </button>
          </td>
        </tr>
      `).join('');

      this.bindToggleButtons();
    } catch (err) {
      ToastComponent.show('Failed to fetch user profiles.', 'error');
    }
  },

  bindToggleButtons() {
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.currentTarget.getAttribute('data-id');
        const fullName = e.currentTarget.getAttribute('data-name');
        const isActive = e.currentTarget.getAttribute('data-active') === 'true';

        ModalComponent.open({
          title: isActive ? 'Disable Account?' : 'Enable Account?',
          bodyHtml: `<p>${isActive ? 'Disable' : 'Enable'} <strong>${escapeHtml(fullName)}</strong>?</p><p>${isActive ? 'They will no longer be able to access the system until the account is enabled again.' : 'They will be able to sign in and access the system again.'}</p>`,
          confirmText: isActive ? 'Disable Account' : 'Enable Account',
          confirmClass: isActive ? 'btn-danger' : 'btn-primary',
          onConfirm: async () => {
            try {
              await UserService.toggleUserStatus(userId, !isActive);
              ToastComponent.show(`Account ${!isActive ? 'activated' : 'disabled'}.`, 'success');
              await this.loadAccounts();
            } catch (err) {
              ToastComponent.show(err.message || 'Failed to change user status.', 'error');
            }
          }
        });
      });
    });
  }
};
