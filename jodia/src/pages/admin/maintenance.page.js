import { ROUTES } from '../../config/constants.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

const STORAGE_KEY = 'denrMaintenanceConfig';

const getConfig = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"enabled": false, "message": ""}');
  } catch (err) {
    return { enabled: false, message: '' };
  }
};

const setConfig = (config) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const AdminMaintenancePage = {
  render() {
    const config = getConfig();

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
                  <p>Toggle the system state and publish a message for users.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="maintenance-toggle" ${config.enabled ? 'checked' : ''} />
                  <span class="slider"></span>
                </label>
              </div>

              <div class="form-group">
                <label for="maintenance-message">Announcement message</label>
                <textarea id="maintenance-message" class="form-input" rows="4" placeholder="Enter maintenance notification...">${escapeHtml(config.message)}</textarea>
              </div>

              <button id="save-maintenance" class="btn btn-primary">Save Maintenance Settings</button>
            </div>

            <div class="card">
              <div class="page-header" style="margin-bottom: 1rem;">
                <div>
                  <h2 class="page-title" style="font-size:1.3rem;">Maintenance guidance</h2>
                </div>
              </div>
              <p style="color:var(--text-muted); line-height:1.75;">Use maintenance mode when the application requires scheduled updates or a temporary pause in operations. When enabled, authenticated users will see a system banner and key workflows are marked as service-limited.</p>
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
                <strong>${config.enabled ? 'Enabled' : 'Disabled'}</strong>
              </div>
              <div class="status-item-row">
                <span>Announcement</span>
                <strong>${config.message ? 'Configured' : 'Not set'}</strong>
              </div>
              <div class="status-item-row">
                <span>Last updated</span>
                <strong>${new Date().toLocaleString()}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;
  },

  async init() {
    document.getElementById('save-maintenance').addEventListener('click', () => {
      const enabled = document.getElementById('maintenance-toggle').checked;
      const message = document.getElementById('maintenance-message').value.trim();

      setConfig({ enabled, message });
      ToastComponent.show('Maintenance settings saved.', 'success');
      window.dispatchEvent(new Event('denr-maintenance-changed'));
    });
  }
};
