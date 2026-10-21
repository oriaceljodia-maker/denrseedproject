import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { AccountSetupStepsComponent } from '../../components/account-setup-steps.component.js';
import { ROUTES } from '../../config/constants.js';

export const ForcePasswordPage = {
  render() {
    return `
      <div class="auth-layout">
        <section class="auth-hero auth-hero-simple">
          <div class="auth-hero-copy">
            <span class="eyebrow">Account Protection</span>
            <h1>Secure Password Setup</h1>
            <p>Create your password, connect or verify your authenticator, then continue straight to your dashboard.</p>
          </div>

          <div class="auth-card">
            <div class="auth-header">
              <img src="/assets/images/logs.jpg" alt="DENR logo" class="auth-logo" />
              <h1 class="auth-title">Set Your New Password</h1>
              <div class="auth-subtitle">Step 1 of 3 · Account setup</div>
            </div>
            <form id="password-reset-form" class="auth-body">
              ${AccountSetupStepsComponent.render(1)}
              <p class="mfa-help">Choose your password now. It will be saved securely after you verify your authenticator in Step 2.</p>
              <div id="reset-error" class="auth-alert" role="alert"></div>

              <div class="form-group">
                <label for="new-password">New Password</label>
                <div class="password-wrapper">
                  <input type="password" id="new-password" class="form-input" autocomplete="new-password" minlength="8" required placeholder="Minimum 8 characters" />
                  <button type="button" class="password-toggle" data-toggle-target="new-password" aria-label="Toggle password visibility">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label for="confirm-password">Confirm Password</label>
                <div class="password-wrapper">
                  <input type="password" id="confirm-password" class="form-input" autocomplete="new-password" minlength="8" required placeholder="Re-enter password" />
                  <button type="button" class="password-toggle" data-toggle-target="confirm-password" aria-label="Toggle password visibility">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <button type="submit" id="btn-reset-submit" class="btn btn-primary auth-btn">
                Continue to Authenticator
              </button>
              <p class="mfa-help">Keep this tab open until setup finishes. Reloading before your password is saved returns you to Step 1.</p>
              <button id="password-setup-sign-out" class="auth-text-button" type="button">Cancel and sign out</button>
            </form>
          </div>
        </section>
      </div>
    `;
  },

  bindEvents() {
    const form = document.getElementById('password-reset-form');
    const errBox = document.getElementById('reset-error');
    const submitBtn = document.getElementById('btn-reset-submit');
    const cancelBtn = document.getElementById('password-setup-sign-out');
    let busy = false;

    cancelBtn.onclick = async () => {
      if (busy) return;
      cancelBtn.disabled = true;
      try {
        await AuthService.logout();
        await Router.navigate(null, ROUTES.LOGIN);
      } catch (error) {
        errBox.textContent = error.message || 'Unable to sign out. Please try again.';
        errBox.style.display = 'block';
        cancelBtn.disabled = false;
      }
    };

    // Password visibility toggles
    document.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.innerHTML = isPassword
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      errBox.style.display = 'none';

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (newPassword !== confirmPassword) {
        errBox.textContent = "Passwords do not match.";
        errBox.style.display = 'block';
        return;
      }

      busy = true;
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      submitBtn.textContent = 'Continuing…';
      try {
        const user = await AuthService.getCurrentUser();
        if (!user) throw new Error('Your session has expired. Please sign in again.');
        if (!form.isConnected) return;
        AuthService.preparePasswordSetup(user.id, newPassword);
        form.reset();
        await Router.navigate({ ...user, passwordSetupReady: true }, ROUTES.MFA);
      } catch (err) {
        errBox.textContent = err.message || 'Failed to update password.';
        errBox.style.display = 'block';
      } finally {
        busy = false;
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        submitBtn.textContent = 'Continue to Authenticator';
      }
    });
  }
};
