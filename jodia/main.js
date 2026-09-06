import { supabase } from './src/config/supabase.js';
import { AuthService } from './src/services/auth.service.js';
import { Router } from './src/router/router.js';
import { MaintenanceService } from './src/services/maintenance.service.js';
import { ROUTES } from './src/config/constants.js';

class App {
  static async init() {
    // Register this before reading the session. Recovery links can create a
    // session immediately, and the event must not be missed during app load.
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        AuthService.beginPasswordRecovery();
        const currentUser = await AuthService.getCurrentUser();
        await Router.navigate(currentUser, ROUTES.FORCE_PASSWORD);
        return;
      }
      if (event === 'USER_UPDATED' && sessionStorage.getItem('denr-password-update-in-progress') === 'true') {
        return;
      }
      if (['SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) MaintenanceService.subscribe();
        await Router.navigate(currentUser);
      }
    });

    // The recovery marker in the URL is a fallback for browsers that restore
    // the Supabase session before the PASSWORD_RECOVERY event is observed.
    if (AuthService.isPasswordRecoveryLink()) AuthService.beginPasswordRecovery();

    // Initial user authentication fetch
    const user = await AuthService.getCurrentUser();
    await Router.navigate(user, AuthService.isPasswordRecoveryLink() ? ROUTES.FORCE_PASSWORD : window.location.pathname);
    if (user) MaintenanceService.subscribe();

    window.addEventListener('denr-maintenance-changed', async () => {
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) await Router.navigate(currentUser, window.location.pathname);
    });

    // Watch for URL navigation changes (browser back/forward)
    window.addEventListener('popstate', async () => {
      const currentUser = await AuthService.getCurrentUser();
      await Router.navigate(currentUser);
    });

  }
}

document.addEventListener('DOMContentLoaded', () => App.init());
