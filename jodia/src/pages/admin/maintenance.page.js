import { ROUTES } from '../../config/constants.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';
import { MaintenanceService } from '../../services/maintenance.service.js';

export const AdminMaintenancePage = {
  render() {
    const config = MaintenanceService.config;

    return `
      <div class="admin-container">
        <div class="page-header">
          <div>
            <span class="eyebrow">Maintenance</span>
            <h1 class="page-title">Site operations & user controls</h1>
            <p class="page-subtitle">Manage system availability, announcements, and user access from a single admin maintenance console.</p>
          </div>
        </div>

        <div class="dashboard-layout">
          <main class="dashboard-main">
            <div class="card maintenance-card">
              <div class="maintenance-header">
                <div>
                  <h2>Maintenance Mode</h2>
                  <p>Pause new requests and request decisions while administrators maintain the system.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="maintenance-toggle" ${config.maintenance_enabled ? 'checked' : ''} />
                  <span class="slider"></span>
                </label>
              </div>

              <div class="form-group">
                <label for="maintenance-message">Announcement message</label>
                <textarea id="maintenance-message" class="form-input" rows="4" placeholder="Enter maintenance notification...">${escapeHtml(config.announcement_message || '')}</textarea>
              </div>

              <button id="save-maintenance" class="btn btn-primary">Save Maintenance Settings</button>
            </div>

            <div class="card">
              <div class="page-header" style="margin-bottom: 1rem;">
                <div>
                  <h2 class="page-title" style="font-size:1.3rem;">Maintenance guidance</h2>
                </div>
              </div>
              <p style="color:var(--text-muted); line-height:1.75;">When enabled, every signed-in user sees the announcement immediately. New personnel requests and admin approval or rejection actions are disabled until maintenance mode is turned off.</p>
              <ul style="margin-top:1rem; padding-left:1.25rem; color:var(--text-muted);">
                <li>Review recent user accounts and activation status.</li>
                <li>Validate inventory before approving new requests.</li>
                <li>Update announcements for personnel during service windows.</li>
              </ul>
            </div>
          </main>

          <aside class="dashboard-side">
            <div class="card quick-access-card">
              <h3>Quick admin actions</h3>
              <div class="quick-card-grid">
                <a href="${ROUTES.ADMIN_ACCOUNTS}" class="quick-card">Manage Personnel Accounts</a>
                <a href="${ROUTES.ADMIN_INVENTORY}" class="quick-card">Inventory Management</a>
                <a href="${ROUTES.ADMIN_REQUESTS}" class="quick-card">Request Queue</a>
              </div>
            </div>

            <div class="card status-card">
              <h3>Maintenance snapshot</h3>
              <div class="status-item-row">
                <span>Status</span>
                <strong>${config.maintenance_enabled ? 'Enabled' : 'Disabled'}</strong>
              </div>
              <div class="status-item-row">
                <span>Announcement</span>
                <strong>${config.announcement_message ? 'Configured' : 'Not set'}</strong>
              </div>
              <div class="status-item-row">
                <span>Last updated</span>
                <strong>${config.updated_at ? new Date(config.updated_at).toLocaleString() : 'Not yet saved'}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;
  },

  async init() {
    try {
      const config = await MaintenanceService.load();
      document.getElementById('maintenance-toggle').checked = config.maintenance_enabled;
      document.getElementById('maintenance-message').value = config.announcement_message || '';
    } catch (error) {
      ToastComponent.show('Maintenance settings are unavailable. Run the Supabase maintenance migration first.', 'error');
    }

    document.getElementById('save-maintenance').addEventListener('click', async () => {
      const enabled = document.getElementById('maintenance-toggle').checked;
      const message = document.getElementById('maintenance-message').value.trim();
      try {
        await MaintenanceService.save({ maintenance_enabled: enabled, announcement_message: message });
        ToastComponent.show('Maintenance settings saved for all users.', 'success');
      } catch (error) {
        ToastComponent.show(error.message || 'Unable to save maintenance settings.', 'error');
      }
    });
  }
};
