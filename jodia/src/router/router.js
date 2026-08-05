import { Guards } from './guards.js';
import { ROUTES } from '../config/constants.js';
import { HeaderComponent } from '../components/header.component.js';
import { NavbarComponent } from '../components/navbar.component.js';
import { MaintenanceBannerComponent } from '../components/maintenance-banner.component.js';

// Page Controller Imports
import { LoginPage } from '../pages/auth/login.page.js';
import { ForcePasswordPage } from '../pages/auth/force-password.page.js';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/dashboard.page.js';
import { AdminInventoryPage } from '../pages/admin/inventory.page.js';
import { AdminRequestsPage } from '../pages/admin/requests.page.js';
import { AdminAccountsPage } from '../pages/admin/accounts.page.js';
import { AdminMaintenancePage } from '../pages/admin/maintenance.page.js';

// Personnel Pages
import { PersonnelCatalogPage } from '../pages/personnel/catalog.page.js';
import { PersonnelMyRequestsPage } from '../pages/personnel/my-requests.page.js';

export const Router = {
  async navigate(user, path = window.location.pathname) {
    const targetPath = Guards.determineTargetRoute(user, path);
    console.debug('Navigating to', targetPath, 'for user', user?.role || 'guest');

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }

    // Render Global Top Header
    HeaderComponent.render(user);

    const root = document.getElementById('app-root');
    const isAuthPage = targetPath === ROUTES.LOGIN || targetPath === ROUTES.FORCE_PASSWORD;

    // Build page content
    let content = '';
    let binder = null;

    switch (targetPath) {
      // Auth Views
      case ROUTES.LOGIN:
        content = LoginPage.render();
        binder = () => LoginPage.bindEvents();
        break;

      case ROUTES.FORCE_PASSWORD:
        content = ForcePasswordPage.render();
        binder = () => ForcePasswordPage.bindEvents();
        break;

      // Admin Views
      case ROUTES.ADMIN_DASHBOARD:
        content = AdminDashboardPage.render();
        binder = () => AdminDashboardPage.init();
        break;

      case ROUTES.ADMIN_INVENTORY:
        content = AdminInventoryPage.render();
        binder = () => AdminInventoryPage.init();
        break;

      case ROUTES.ADMIN_REQUESTS:
        content = AdminRequestsPage.render();
        binder = () => AdminRequestsPage.init();
        break;

      case ROUTES.ADMIN_ACCOUNTS:
        content = AdminAccountsPage.render();
        binder = () => AdminAccountsPage.init();
        break;

      case ROUTES.ADMIN_MAINTENANCE:
        content = AdminMaintenancePage.render();
        binder = () => AdminMaintenancePage.init();
        break;

      // Personnel Views
      case ROUTES.PERSONNEL_CATALOG:
        content = PersonnelCatalogPage.render();
        binder = () => PersonnelCatalogPage.init();
        break;

      case ROUTES.PERSONNEL_REQUESTS:
        content = PersonnelMyRequestsPage.render();
        binder = () => PersonnelMyRequestsPage.init();
        break;

      default:
        content = `<div style="padding: 2rem; text-align:center;"><h3>404 - Page Not Found</h3></div>`;
    }

    // Prepend sub-navigation for authenticated (non-auth) pages
    if (!isAuthPage) {
      const navbar = NavbarComponent.render(user);
      NavbarComponent.bindEvents(user);
      content = navbar + content;
    }

    const bannerHtml = MaintenanceBannerComponent.render();
    root.innerHTML = bannerHtml + content;
    if (binder) binder();
  }
};
