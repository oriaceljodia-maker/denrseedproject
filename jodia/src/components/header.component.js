import { AuthService } from '../services/auth.service.js';
import { Router } from '../router/router.js';

export const HeaderComponent = {
  render(user) {
    const headerEl = document.getElementById('app-header');

    if (!user) {
      headerEl.classList.add('hidden');
      headerEl.innerHTML = '';
      return;
    }

    headerEl.classList.remove('hidden');
    headerEl.innerHTML = `
      <div class="nav-brand" style="display: flex; align-items: center; gap: 0.75rem;">
        <img src="/assets/images/denr-logo.png" alt="DENR Logo" style="height: 38px; width: 38px;" onerror="this.style.display='none'" />
        <div>
          <div style="font-weight: 700; font-size: 1rem; line-height: 1.2;">DENR Seed Inventory</div>
          <div style="font-size: 0.7rem; color: #A0AEC0;">Forest Management Sector</div>
        </div>
      </div>

      <div class="nav-right" style="display: flex; align-items: center; gap: 1.25rem;">
        <span class="badge badge-${user.role}">${user.role}</span>
        <span style="font-size: 0.875rem; font-weight: 500;">${user.fullName}</span>
        <button id="btn-global-logout" class="btn btn-secondary">
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