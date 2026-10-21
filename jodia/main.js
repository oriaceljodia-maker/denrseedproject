import { supabase } from './src/config/supabase.js';
import { AuthService } from './src/services/auth.service.js';
import { MfaService } from './src/services/mfa.service.js';
import { Router } from './src/router/router.js';
import { Guards } from './src/router/guards.js';
import { MaintenanceService } from './src/services/maintenance.service.js';
import { ROUTES } from './src/config/constants.js';

class App {
  static ready = false;
  static authTimer = null;
  static refreshVersion = 0;

  static async refreshRoute(path = window.location.pathname, force = true) {
    const version = ++this.refreshVersion;
    try {
      const user = await AuthService.getCurrentUser();
      if (version !== this.refreshVersion) return;
      const target = Guards.determineTargetRoute(user, path);
      if (!force && target === window.location.pathname) return;
      await Router.navigate(user, target);
    } catch {
      if (version !== this.refreshVersion) return;
      // Fail closed while still offering sign-in after a network error.
      await Router.navigate(null, ROUTES.LOGIN);
      const errorBox = document.getElementById('auth-error');
      if (errorBox) {
        errorBox.textContent = 'Your session could not be checked. Please try signing in again.';
        errorBox.style.display = 'block';
      }
    }
  }

  static async init() {
    // SDK callbacks run under the session lock. Defer other auth calls until
    // it is released, otherwise login/MFA/recovery can wait indefinitely.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') AuthService.beginPasswordRecovery();
      if (event === 'SIGNED_OUT') {
        this.refreshVersion++;
        MfaService.clear();
        AuthService.clearPasswordSetup();
        AuthService.clearPasswordRecovery();
        MaintenanceService.unsubscribe();
      }
      if (!this.ready || (event === 'SIGNED_IN' && AuthService.signInInProgress)) return;
      if (sessionStorage.getItem('denr-password-update-in-progress') === 'true' && event !== 'SIGNED_OUT') return;
      // The MFA form owns its success navigation. Do not erase its QR or
      // code input when MFA_CHALLENGE_VERIFIED fires.
      if (!['SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return;
      window.clearTimeout(this.authTimer);
      this.authTimer = window.setTimeout(() => {
        this.refreshRoute(event === 'PASSWORD_RECOVERY' ? ROUTES.FORCE_PASSWORD : window.location.pathname, false);
      }, 0);
    });

    if (AuthService.isPasswordRecoveryLink()) AuthService.beginPasswordRecovery();
    await this.refreshRoute();
    this.ready = true;

    window.addEventListener('denr-maintenance-changed', () => this.refreshRoute());
    window.addEventListener('popstate', () => this.refreshRoute());
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());
