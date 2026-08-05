import { AuthService } from '../services/auth.service.js';
import { Router } from '../router/router.js';
import { escapeHtml } from '../../utils/formatters.js';

export const HeaderComponent = {
  render(user) {
    const headerEl = document.getElementById('app-header');

    if (!user) {
      headerEl.classList.add('hidden');
      headerEl.innerHTML = '';
      return;
    }

    console.debug('Rendering header for user:', user?.email);

    const roleLabel = user.role === 'admin' ? 'Administrator' : 'Field Personnel';

    headerEl.classList.remove('hidden');
    headerEl.innerHTML = `
      <div class="header-brand">
        <div class="header-logo-wrap">
          <img src="/assets/images/denr-logo-icon.svg" alt="DENR Seed Inventory logo" class="header-logo" onerror="this.onerror=null; this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Department_of_Environment_and_Natural_Resources_%28DENR%29.svg/1200px-Department_of_Environment_and_Natural_Resources_%28DENR%29.svg.png';" />
        </div>
        <div class="header-brand-copy">
          <div class="header-title">DENR Seed Inventory</div>
          <div class="header-subtitle">Forestry seed stewardship for conservation and restoration</div>
        </div>
      </div>

      <div class="header-actions">
        <div class="header-user-wrap">
          <span class="header-user">${escapeHtml(user.fullName)}</span>
          <span class="badge badge-${escapeHtml(user.role)} header-role-badge">${roleLabel}</span>
        </div>
        <button id="btn-global-logout" class="btn btn-secondary btn-logout" title="Sign out of the system">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    `;

    document.getElementById('btn-global-logout')?.addEventListener('click', async () => {
      await AuthService.logout();
      await Router.navigate(null);
    });
  }
};