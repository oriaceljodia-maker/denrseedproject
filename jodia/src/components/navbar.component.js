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
      { path: ROUTES.ADMIN_ACCOUNTS, label: 'Personnel Accounts' },
      { path: ROUTES.ADMIN_MAINTENANCE, label: 'Maintenance' }
    ];

    const personnelLinks = [
      { path: ROUTES.PERSONNEL_CATALOG, label: 'Seed Catalog' },
      { path: ROUTES.PERSONNEL_REQUESTS, label: 'My Requests' }
    ];

    const links = user.role === 'admin' ? adminLinks : personnelLinks;

    return `
      <nav class="sub-nav">
        <div class="nav-links">
          ${links.map(link => `
            <a href="${link.path}" 
               class="nav-link ${currentPath === link.path ? 'active' : ''}" 
               data-link>
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