import { LoginActivityService } from '../../services/login-activity.service.js';
import { ToastComponent } from '../../components/toast.component.js';
import { escapeHtml } from '../../../utils/formatters.js';

export const AdminLoginTrailsPage = {
  allActivity: [],

  render() {
    return `
      <div class="admin-container">
        <div class="catalog-hero" style="margin-bottom: 1.25rem;">
          <div class="eyebrow">Security audit</div>
          <h1>Login Trails</h1>
          <p>Review successful sign-ins recorded across the seed inventory system.</p>
        </div>

        <div class="filter-bar" style="margin-bottom: 1rem;">
          <div class="search-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="search" id="login-trails-search" class="form-input" placeholder="Search by name or email..." />
          </div>
          <button type="button" id="btn-refresh-login-trails" class="btn btn-secondary">Refresh</button>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Outcome</th><th>Signed In</th></tr></thead>
              <tbody id="login-trails-table-body"><tr><td colspan="5" style="text-align:center;">Loading login activity...</td></tr></tbody>
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
        (activity.profiles?.full_name || '').toLowerCase().includes(query) ||
        (activity.email || '').toLowerCase().includes(query)
      );
      this.renderActivity(filtered);
    });

    document.getElementById('btn-refresh-login-trails')?.addEventListener('click', async () => {
      await this.loadActivity();
    });
  },

  async loadActivity() {
    try {
      this.allActivity = await LoginActivityService.getLoginActivity();
      this.renderActivity(this.allActivity);
    } catch (error) {
      ToastComponent.show(error.message || 'Failed to fetch login activity.', 'error');
      const tbody = document.getElementById('login-trails-table-body');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Unable to load login activity.</td></tr>';
    }
  },

  renderActivity(activity) {
    const tbody = document.getElementById('login-trails-table-body');
    if (!tbody) return;

    if (!activity?.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No login activity found.</td></tr>';
      return;
    }

    tbody.innerHTML = activity.map(entry => {
      const profile = entry.profiles;
      const date = new Date(entry.created_at);
      const signedIn = Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
      return `<tr>
        <td><strong>${escapeHtml(profile?.full_name || 'Unknown user')}</strong></td>
        <td>${escapeHtml(entry.email)}</td>
        <td>${escapeHtml(profile?.role || '—')}</td>
        <td><span class="badge badge-approved">${escapeHtml(entry.outcome)}</span></td>
        <td>${escapeHtml(signedIn)}</td>
      </tr>`;
    }).join('');
  }
};
