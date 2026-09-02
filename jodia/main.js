import { supabase } from './src/config/supabase.js';
import { AuthService } from './src/services/auth.service.js';
import { Router } from './src/router/router.js';
import { MaintenanceService } from './src/services/maintenance.service.js';

class App {
  static async init() {
    // Initial user authentication fetch
    const user = await AuthService.getCurrentUser();
    await Router.navigate(user);
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

    // Realtime auth state listener.
    // NOTE: SIGNED_IN is intentionally NOT handled here — the LoginPage performs
    // an explicit Router.navigate() after a successful sign-in. Handling SIGNED_IN
    // here too causes a race: getCurrentUser() can temporarily return null (before
    // the session/profile fully settles), which would call logout() and bounce the
    // user right back to the login page.
    supabase.auth.onAuthStateChange(async (event) => {
      if (['SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) MaintenanceService.subscribe();
        await Router.navigate(currentUser);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());
