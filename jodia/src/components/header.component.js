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

    headerEl.classList.remove('hidden');
    headerEl.innerHTML = `
      <div class="header-brand">
        <img src="/assets/images/denr-logo.png" alt="DENR Logo" class="header-logo" onerror="this.style.display='none'" />
        <div class="header-brand-copy">
          <div class="header-title">DENR Seed Inventory</div>
          <div class="header-subtitle">Forest Resource Distribution</div>
        </div>
      </div>

      <div class="header-actions">
        <span class="badge badge-${escapeHtml(user.role)}">${escapeHtml(user.role)}</span>
        <span class="header-user">${escapeHtml(user.fullName)}</span>
        <button id="btn-global-logout" class="btn btn-secondary btn-logout">Logout</button>
      </div>
    `;

    document.getElementById('btn-global-logout')?.addEventListener('click', async () => {
      await AuthService.logout();
      await Router.navigate(null);
    });
  }
};