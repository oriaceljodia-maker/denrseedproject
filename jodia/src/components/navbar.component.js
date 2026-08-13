import { Router } from '../router/router.js';
import { ROUTES } from '../config/constants.js';
import { AuthService } from '../services/auth.service.js';
import { escapeAttr, escapeHtml } from '../../utils/formatters.js';

const navigationIcons = {
  dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><rect x="14" y="14" width="6.5" height="6.5" rx="1"/></svg>',
  seeds: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4C13.7 4.1 8.8 6.1 6.2 10.2c-1.7 2.7-1.8 5.8-1.7 7.8 2.3.2 5.6 0 8.3-1.8C16.9 13.5 18.8 8.6 20 4Z"/><path d="M4 20c2.4-4.2 6.1-7 11.2-9.2"/></svg>',
  requests: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4.5h6v3H9zM8.5 13l2.1 2.1 4.5-4.5"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.8 19c.5-3 2.5-5 5.2-5s4.7 2 5.2 5M16 5.5a3 3 0 0 1 0 5.8M17.5 14.2c1.5.7 2.5 2.3 2.7 4.8"/></svg>',
  trails: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 19 6v5.2c0 4.2-2.8 7.7-7 9.3-4.2-1.6-7-5.1-7-9.3V6l7-2.5Z"/><path d="m8.8 11.8 2.1 2.1 4.4-4.4"/></svg>',
  maintenance: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.2 2.2-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.7v.2h-3v-.2a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .4l-.1.1-2.2-2.2.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.7-1.1H4.7v-3h.2A1.8 1.8 0 0 0 6.6 9a1.8 1.8 0 0 0-.4-2l-.1-.1 2.2-2.2.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.7v-.2h3v.2A1.8 1.8 0 0 0 15.6 5a1.8 1.8 0 0 0 2-.4l.1-.1 2.2 2.2-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.7 1.1h.2v3h-.2a1.8 1.8 0 0 0-1.7 1.1Z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.7-4 3.5-6.4 7.5-6.4s6.8 2.4 7.5 6.4"/></svg>',
  logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>'
};

export const NavbarComponent = {
  render(user) {
    if (!user || user.requiresPasswordChange) return '';

    const currentPath = window.location.pathname;

    const adminLinks = [
      { path: ROUTES.ADMIN_DASHBOARD, label: 'Dashboard', icon: 'dashboard' },
      { path: ROUTES.ADMIN_INVENTORY, label: 'Seeds', icon: 'seeds' },
      { path: ROUTES.ADMIN_REQUESTS, label: 'Approve Requests', icon: 'requests' },
      { path: ROUTES.ADMIN_ACCOUNTS, label: 'Users', icon: 'users' },
      { path: ROUTES.ADMIN_LOGIN_TRAILS, label: 'Login Trails', icon: 'trails' },
      { path: ROUTES.ADMIN_MAINTENANCE, label: 'Maintenance', icon: 'maintenance' }
    ];

    const personnelLinks = [
      { path: ROUTES.PERSONNEL_CATALOG, label: 'Available Seeds', icon: 'seeds' },
      { path: ROUTES.PERSONNEL_REQUESTS, label: 'My Requests', icon: 'requests' }
    ];

    const links = user.role === 'admin' ? adminLinks : personnelLinks;

    const roleLabel = user.role === 'admin' ? 'Administrator' : 'Personnel';
    const initial = escapeHtml((user.fullName || 'U').trim().charAt(0).toUpperCase());
    const avatar = user.avatarUrl ? `<img src="${escapeAttr(user.avatarUrl)}" alt="" />` : '';
    return `
      <aside class="app-sidebar">
        <div class="sidebar-brand"><img src="/assets/images/logs.jpg" alt="DENR logo" /><div><strong>DENR Talipan</strong><span>Seed Inventory System</span></div></div>
        <a href="${ROUTES.PROFILE}" class="sidebar-profile" data-link>${`<span class="sidebar-avatar">${avatar}<span class="sidebar-avatar-initial">${initial}</span></span>`}<span class="sidebar-profile-copy"><strong>${escapeHtml(user.fullName)}</strong><span>${roleLabel}</span></span></a>
        <nav class="sidebar-nav" aria-label="Main navigation"><span class="sidebar-nav-heading">Menu</span>${links.map(link => `<a href="${link.path}" class="sidebar-link ${currentPath === link.path ? 'active' : ''}" data-link><span class="sidebar-link-icon">${navigationIcons[link.icon]}</span><span>${link.label}</span></a>`).join('')}</nav>
        <div class="sidebar-footer"><a href="${ROUTES.PROFILE}" class="sidebar-link ${currentPath === ROUTES.PROFILE ? 'active' : ''}" data-link><span class="sidebar-link-icon">${navigationIcons.profile}</span><span>Profile</span></a><button type="button" class="sidebar-link sidebar-logout" id="btn-sidebar-logout"><span class="sidebar-link-icon">${navigationIcons.logout}</span><span>Logout</span></button></div>
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
