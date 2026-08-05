import { UserService } from '../../services/user.service.js';
import { ToastComponent } from '../../components/toast.component.js';

export const AdminAccountsPage = {
  render() {
    return `
      <div class="admin-container">
        <div style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.5rem; color: var(--denr-navy-primary);">Personnel User Accounts</h1>
          <p style="font-size: 0.875rem; color: var(--text-muted);">Manage registered personnel, roles, and status controls</p>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Password Reset Status</th>
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
          <td><strong>${u.full_name}</strong></td>
          <td><span class="badge badge-${u.role}">${u.role}</span></td>
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
            <button class="btn btn-secondary btn-toggle-status" data-id="${u.id}" data-active="${u.is_active}" style="color: var(--denr-navy-primary); border-color: var(--border-color); font-size:0.75rem; padding: 0.25rem 0.5rem;">
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
        const isActive = e.currentTarget.getAttribute('data-active') === 'true';

        try {
          await UserService.toggleUserStatus(userId, !isActive);
          ToastComponent.show(`Account ${!isActive ? 'activated' : 'disabled'}.`, 'success');
          await this.loadAccounts();
        } catch (err) {
          ToastComponent.show(err.message || 'Failed to change user status.', 'error');
        }
      });
    });
  }
};