import { Router } from '../router/router.js';
import { ROUTES } from '../config/constants.js';

export const NavbarComponent = {
  render(user) {
    if (!user || user.requiresPasswordChange) return '';

    const currentPath = window.location.pathname;

    const adminLinks = [
      { path: ROUTES.ADMIN_DASHBOARD, label: 'Overview' },
      { path: ROUTES.ADMIN_INVENTORY, label: 'Inventory' },
      { path: ROUTES.ADMIN_REQUESTS, label: 'Requests Queue' },
      { path: ROUTES.ADMIN_ACCOUNTS, label: 'Personnel Accounts' }
    ];

    const personnelLinks = [
      { path: ROUTES.PERSONNEL_CATALOG, label: 'Seed Catalog' },
      { path: ROUTES.PERSONNEL_REQUESTS, label: 'My Requests' }
    ];

    const links = user.role === 'admin' ? adminLinks : personnelLinks;

    return `
      <nav class="sub-nav" style="background: var(--denr-navy-primary); border-top: 1px solid rgba(255,255,255,0.1); padding: 0 2rem;">
        <div style="display: flex; gap: 1.5rem; max-width: 1400px; margin: 0 auto;">
          ${links.map(link => `
            <a href="${link.path}" 
               class="nav-link ${currentPath === link.path ? 'active' : ''}" 
               data-link
               style="color: ${currentPath === link.path ? '#4ADE80' : '#E2E8F0'}; 
                      text-decoration: none; 
                      padding: 0.75rem 0; 
                      font-size: 0.875rem; 
                      font-weight: 600; 
                      border-bottom: 2px solid ${currentPath === link.path ? '#4ADE80' : 'transparent'};">
              ${link.label}
            </a>
          `).join('')}
        </div>
      </nav>
    `;
  },

  bindEvents(user) {
    document.querySelectorAll('[data-link]').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetPath = e.currentTarget.getAttribute('href');
        await Router.navigate(user, targetPath);
      });
    });
  }
};