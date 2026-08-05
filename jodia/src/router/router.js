import { Guards } from './guards.js';
import { ROUTES } from '../config/constants.js';
import { HeaderComponent } from '../components/header.component.js';

// Page Controller Imports
import { LoginPage } from '../pages/auth/login.page.js';
import { ForcePasswordPage } from '../pages/auth/force-password.page.js';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/dashboard.page.js';
import { AdminInventoryPage } from '../pages/admin/inventory.page.js';
import { AdminRequestsPage } from '../pages/admin/requests.page.js';
import { AdminAccountsPage } from '../pages/admin/accounts.page.js';

// Personnel Pages
import { PersonnelCatalogPage } from '../pages/personnel/catalog.page.js';
import { PersonnelMyRequestsPage } from '../pages/personnel/my-requests.page.js';

export const Router = {
  async navigate(user, path = window.location.pathname) {
    const targetPath = Guards.determineTargetRoute(user, path);

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }

    // Render Global Top Header
    HeaderComponent.render(user);

    const root = document.getElementById('app-root');

    switch (targetPath) {
      // Auth Views
      case ROUTES.LOGIN:
        root.innerHTML = LoginPage.render();
        LoginPage.bindEvents();
        break;

      case ROUTES.FORCE_PASSWORD:
        root.innerHTML = ForcePasswordPage.render();
        ForcePasswordPage.bindEvents();
        break;

      // Admin Views
      case ROUTES.ADMIN_DASHBOARD:
        root.innerHTML = AdminDashboardPage.render();
        AdminDashboardPage.init();
        break;

      case ROUTES.ADMIN_INVENTORY:
        root.innerHTML = AdminInventoryPage.render();
        AdminInventoryPage.init();
        break;

      case ROUTES.ADMIN_REQUESTS:
        root.innerHTML = AdminRequestsPage.render();
        AdminRequestsPage.init();
        break;

      case ROUTES.ADMIN_ACCOUNTS:
        root.innerHTML = AdminAccountsPage.render();
        AdminAccountsPage.init();
        break;

      // Personnel Views
      case ROUTES.PERSONNEL_CATALOG:
        root.innerHTML = PersonnelCatalogPage.render();
        PersonnelCatalogPage.init();
        break;

      case ROUTES.PERSONNEL_REQUESTS:
        root.innerHTML = PersonnelMyRequestsPage.render();
        PersonnelMyRequestsPage.init();
        break;

      default:
        root.innerHTML = `<div style="padding: 2rem; text-align:center;"><h3>404 - Page Not Found</h3></div>`;
    }
  }
};