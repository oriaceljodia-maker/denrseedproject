import { Router } from '../router/router.js';
import { ROUTES } from '../config/constants.js';
import { AuthService } from '../services/auth.service.js';
import { escapeAttr, escapeHtml } from '../../utils/formatters.js';

export const NavbarComponent = {
  render(user) {
    if (!user || user.requiresPasswordChange) return '';

    const currentPath = window.location.pathname;

    const adminLinks = [
      { path: ROUTES.ADMIN_DASHBOARD, label: 'Dashboard' },
      { path: ROUTES.ADMIN_INVENTORY, label: 'Seeds' },
      { path: ROUTES.ADMIN_REQUESTS, label: 'Approve Requests' },
      { path: ROUTES.ADMIN_ACCOUNTS, label: 'Users' },
      { path: ROUTES.ADMIN_MAINTENANCE, label: 'Maintenance' }
    ];

    const personnelLinks = [
      { path: ROUTES.PERSONNEL_CATALOG, label: 'Available Seeds' },
      { path: ROUTES.PERSONNEL_REQUESTS, label: 'My Requests' }
    ];

    const links = user.role === 'admin' ? adminLinks : personnelLinks;

    const roleLabel = user.role === 'admin' ? 'Administrator' : 'Personnel';
    const initial = escapeHtml((user.fullName || 'U').trim().charAt(0).toUpperCase());
    const avatar = user.avatarUrl ? `<img src="${escapeAttr(user.avatarUrl)}" alt="" />` : '';
    return `
      <aside class="app-sidebar">
        <div class="sidebar-brand"><img src="/assets/images/denr-logo-icon.svg" alt="DENR" /><div><strong>DENR Talipan</strong><span>Seed Inventory System</span></div></div>
        <a href="${ROUTES.PROFILE}" class="sidebar-profile" data-link>${`<span class="sidebar-avatar">${avatar}<span class="sidebar-avatar-initial">${initial}</span></span>`}<span class="sidebar-profile-copy"><strong>${escapeHtml(user.fullName)}</strong><span>${roleLabel}</span></span></a>
        <nav class="sidebar-nav" aria-label="Main navigation"><span class="sidebar-nav-heading">Menu</span>${links.map(link => `<a href="${link.path}" class="sidebar-link ${currentPath === link.path ? 'active' : ''}" data-link>${link.label}</a>`).join('')}</nav>
        <div class="sidebar-footer"><a href="${ROUTES.PROFILE}" class="sidebar-link ${currentPath === ROUTES.PROFILE ? 'active' : ''}" data-link>Profile</a><button type="button" class="sidebar-logout" id="btn-sidebar-logout">Log out</button></div>
      </aside>`;
  },

  bindEvents(user) {
    document.querySelectorAll('[data-link]').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetPath = e.currentTarget.getAttribute('href');
        await Router.navigate(user, targetPath);
      });
    });
    document.getElementById('btn-sidebar-logout')?.addEventListener('click', async () => {
      await AuthService.logout();
      await Router.navigate(null);
    });
  }
};
