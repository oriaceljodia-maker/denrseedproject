import { AuditTrailService } from '../../services/audit-trail.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const AdminLoginTrailsPage = {
  allActivity: [],
  auditTrailAvailable: true,

  render() {
    return `
      <div class="admin-container">
        <div class="catalog-hero" style="margin-bottom: 1.25rem;">
          <div class="eyebrow">System audit</div>
          <h1>Audit Trails</h1>
          <p>Review successful sign-ins and administrative inventory, request, and account actions.</p>
        </div>

        <div class="filter-bar" style="margin-bottom: 1rem;">
          <div class="search-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="search" id="login-trails-search" class="form-input" placeholder="Search by action, user, or details..." />
          </div>
          <button type="button" id="btn-refresh-login-trails" class="btn btn-secondary">Refresh</button>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>Action</th><th>Details</th><th>User</th><th>Role</th><th>When</th></tr></thead>
              <tbody id="login-trails-table-body"><tr><td colspan="5" style="text-align:center;">Loading audit activity...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    this.bindEvents();
    await this.loadActivity();
  },

  bindEvents() {
    document.getElementById('login-trails-search')?.addEventListener('input', event => {
      const query = event.currentTarget.value.toLowerCase().trim();
      const filtered = this.allActivity.filter(activity =>
        (activity.actorName || '').toLowerCase().includes(query) ||
        (activity.action || '').toLowerCase().includes(query) ||
        (activity.details || '').toLowerCase().includes(query)
      );
      this.renderActivity(filtered);
    });

    document.getElementById('btn-refresh-login-trails')?.addEventListener('click', async () => {
      await this.loadActivity();
    });

  },

  async loadActivity() {
    try {
      const result = await AuditTrailService.getActivity();
      this.allActivity = result.activity;
      this.auditTrailAvailable = result.auditTrailAvailable;
      this.renderActivity(this.allActivity);
    } catch (error) {
      ToastComponent.show(error.message || 'Failed to fetch audit activity.', 'error');
      const tbody = document.getElementById('login-trails-table-body');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Unable to load audit activity.</td></tr>';
    }
  },

  renderActivity(activity) {
    const tbody = document.getElementById('login-trails-table-body');
    if (!tbody) return;

    if (!activity?.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${this.auditTrailAvailable ? 'No audit activity found.' : 'Run audit_trail_setup.sql in Supabase to capture administrative actions.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = activity.map(entry => {
      const date = new Date(entry.createdAt);
      const timestamp = Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
      return `<tr>
        <td><strong>${escapeHtml(entry.action)}</strong></td>
        <td>${escapeHtml(entry.details || '—')}</td>
        <td>${escapeHtml(entry.actorName || 'System')}</td>
        <td>${escapeHtml(entry.actorRole || '—')}</td>
        <td>${escapeHtml(timestamp)}</td>
      </tr>`;
    }).join('');
  }
};
