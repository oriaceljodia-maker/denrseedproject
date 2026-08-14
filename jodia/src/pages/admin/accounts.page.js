import { UserService } from '../../services/user.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { ModalComponent } from '../../components/modal.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const AdminAccountsPage = {
  render() {
    return `
      <div class="admin-container">
        <div style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">Personnel User Accounts</h1>
          <p style="font-size: 0.875rem; color: var(--text-muted);">Manage registered personnel, roles, and status controls</p>
        </div>

      <div class="card">
        <div class="section-block">
          <h2 class="section-title">Create new personnel account</h2>
          <p>Enter registration details for a new personnel account. Admins can assign role and optional password.</p>
          <div class="form-row">
            <div class="form-group" style="flex: 1; min-width: 220px;">
              <label for="new-user-email">Email address</label>
              <input type="email" id="new-user-email" class="form-input" placeholder="email@denr.gov.ph" />
            </div>
            <div class="form-group" style="flex: 1; min-width: 220px;">
              <label for="new-user-fullname">Full name</label>
              <input type="text" id="new-user-fullname" class="form-input" placeholder="Juan Dela Cruz" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 1; min-width: 220px;">
              <label for="new-user-role">Role</label>
              <select id="new-user-role" class="form-input">
                <option value="personnel" selected>Personnel</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1; min-width: 220px;">
              <label for="new-user-password">Temporary password</label>
              <input type="text" id="new-user-password" class="form-input" placeholder="Leave blank to auto-generate" />
            </div>
          </div>
          <button id="btn-create-user" class="btn btn-secondary">Create account</button>
          <div id="create-user-message" class="table-empty-message" style="display:none; margin-top:1rem;"></div>
        </div>
      </div>

      <div class="card">
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
      </div>
    </div>
    `;
  },

  async init() {
    await this.loadAccounts();
    this.bindCreateUser();
  },

  async createUser() {
    const email = document.getElementById('new-user-email').value.trim();
    const fullName = document.getElementById('new-user-fullname').value.trim();
    const role = document.getElementById('new-user-role').value;
    const password = document.getElementById('new-user-password').value.trim() || null;
    const messageEl = document.getElementById('create-user-message');

    if (!email || !fullName) {
      messageEl.style.display = 'block';
      messageEl.textContent = 'Email and full name are required to create a new account.';
      return;
    }

    try {
      await UserService.createPersonnelAccount(email, fullName, role, password);
      messageEl.style.display = 'block';
      messageEl.textContent = 'Account created successfully. Temporary password has been issued.';
      messageEl.style.color = 'var(--denr-green-primary)';
      document.getElementById('new-user-email').value = '';
      document.getElementById('new-user-fullname').value = '';
      document.getElementById('new-user-password').value = '';
      await this.loadAccounts();
    } catch (err) {
      messageEl.style.display = 'block';
      messageEl.textContent = err.message || 'Failed to create the account.';
      messageEl.style.color = 'var(--status-danger)';
    }
  },

  bindCreateUser() {
    document.getElementById('btn-create-user')?.addEventListener('click', async () => {
      await this.createUser();
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
