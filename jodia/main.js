import { supabase } from './src/config/supabase.js';
import { AuthService } from './src/services/auth.service.js';
import { Router } from './src/router/router.js';

class App {
  static async init() {
    // Initial user authentication fetch
    const user = await AuthService.getCurrentUser();
    await Router.navigate(user);

    // Watch for URL navigation changes (browser back/forward)
    window.addEventListener('popstate', async () => {
      const currentUser = await AuthService.getCurrentUser();
      await Router.navigate(currentUser);
    });

    // Realtime auth state listener
    supabase.auth.onAuthStateChange(async (event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        const currentUser = await AuthService.getCurrentUser();
        await Router.navigate(currentUser);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());