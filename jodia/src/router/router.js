import { Guards } from './guards.js';
import { ROUTES } from '../config/constants.js';
import { HeaderComponent } from '../components/header.component.js';
import { NavbarComponent } from '../components/navbar.component.js';
import { FooterComponent } from '../components/footer.component.js';
import { MaintenanceBannerComponent } from '../components/maintenance-banner.component.js';

// Page Controller Imports
import { LoginPage } from '../pages/auth/login.page.js';
import { ForcePasswordPage } from '../pages/auth/force-password.page.js';

// Admin Pages
import { AdminDashboardPage } from '../pages/admin/dashboard.page.js';
import { AdminInventoryPage } from '../pages/admin/inventory.page.js';
import { AdminRequestsPage } from '../pages/admin/requests.page.js';
import { AdminAccountsPage } from '../pages/admin/accounts.page.js';
import { AdminLoginTrailsPage } from '../pages/admin/login-trails.page.js';
import { AdminReportsPage } from '../pages/admin/reports.page.js';
import { AdminMaintenancePage } from '../pages/admin/maintenance.page.js';

// Personnel Pages
import { PersonnelCatalogPage } from '../pages/personnel/catalog.page.js';
import { PersonnelMyRequestsPage } from '../pages/personnel/my-requests.page.js';
import { PersonnelDashboardPage } from '../pages/personnel/dashboard.page.js';
import { ProfilePage } from '../pages/profile/profile.page.js';

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

      case ROUTES.PROFILE:
        content = ProfilePage.render();
        binder = () => ProfilePage.init();
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

      case ROUTES.ADMIN_LOGIN_TRAILS:
        content = AdminLoginTrailsPage.render();
        binder = () => AdminLoginTrailsPage.init();
        break;

      case ROUTES.ADMIN_REPORTS:
        content = AdminReportsPage.render();
        binder = () => AdminReportsPage.init();
        break;

      case ROUTES.ADMIN_MAINTENANCE:
        content = AdminMaintenancePage.render();
        binder = () => AdminMaintenancePage.init();
        break;

      // Personnel Views
      case ROUTES.PERSONNEL_DASHBOARD:
        content = PersonnelDashboardPage.render();
        binder = () => PersonnelDashboardPage.init();
        break;

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
    let hasNavbar = false;
    if (!isAuthPage) {
      const navbar = NavbarComponent.render(user);
      content = `<div class="app-shell">${navbar}<div class="app-content">${content}</div></div>`;
      hasNavbar = true;
    }

    const bannerHtml = MaintenanceBannerComponent.render();
    const footerHtml = FooterComponent.render();
    root.innerHTML = bannerHtml + content + footerHtml;
    if (hasNavbar) NavbarComponent.bindEvents(user);
    if (binder) binder();
  }
};
