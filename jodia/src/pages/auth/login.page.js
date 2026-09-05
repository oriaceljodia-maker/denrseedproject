import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ToastComponent } from '../../components/toast.component.js';
import { AccessRequestService } from '../../services/access-request.service.js';
import { MaintenanceService } from '../../services/maintenance.service.js';
import { PasswordResetRequestService } from '../../services/password-reset-request.service.js';

export const LoginPage = {
  render() {
    return `
      <div class="auth-layout">
        <section class="auth-hero">
          <div class="auth-hero-copy">
            <span class="eyebrow">Department of Environment and Natural Resources</span>
            <h1>Seed Inventory &amp; <em>Distribution Portal</em></h1>
            <div class="portal-track">Track <b>•</b> Manage <b>•</b> Distribute <b>•</b> Reforest</div>
            <p>A digital platform for managing seed inventory, tracking distributions, and promoting reforestation and sustainable communities.</p>
            <div class="hero-features">
              <span><strong>Inventory Management</strong>Track and manage seed stocks in real time.</span>
              <span><strong>Reports &amp; Analytics</strong>Generate insights for better decisions.</span>
              <span><strong>Seed Distribution</strong>Monitor and record seed distributions.</span>
              <span><strong>Sustainable Future</strong>Support reforestation and greener communities.</span>
            </div>
          </div>

          <div class="auth-card">
            <div class="auth-header">
              <img src="/assets/images/logs.jpg" alt="DENR logo" class="auth-logo" />
              <h1 class="auth-title">Access Your Account</h1>
              <div class="auth-subtitle">Sign in or request access</div>
            </div>

            <div class="auth-mode-tabs" role="tablist">
              <button type="button" id="show-sign-in" class="auth-mode-tab active" role="tab" aria-selected="true">Sign In</button>
              <button type="button" id="show-access-request" class="auth-mode-tab" role="tab" aria-selected="false">Get Access</button>
            </div>
            <form id="login-form" class="auth-body">
              <div id="auth-error" class="auth-alert"></div>

              <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" class="form-input" placeholder="user@denr.gov.ph" required />
              </div>

              <div class="form-group">
                <label for="password">Password</label>
                <div class="password-wrapper">
                  <input type="password" id="password" class="form-input" placeholder="••••••••" required />
                  <button type="button" class="password-toggle" id="toggle-password" aria-label="Toggle password visibility">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <button type="submit" id="btn-submit" class="btn btn-primary auth-btn">Sign In</button>

              <p class="auth-footnote"><button type="button" class="auth-text-button" id="show-password-reset">Forgot password?</button></p>
            </form>

            <form id="access-request-form" class="auth-body" hidden>
              <div id="access-request-error" class="auth-alert"></div>
              <div class="form-group"><label for="access-name">Full Name <span class="field-optional">(optional)</span></label><input type="text" id="access-name" class="form-input" placeholder="Your full name" /></div>
              <div class="form-group"><label for="access-email">Your Email</label><input type="email" id="access-email" class="form-input" placeholder="you@denr.gov.ph" required /></div>
              <p class="auth-access-copy">Submit your request and an administrator will review it before creating your account.</p>
              <button type="submit" id="btn-access-request" class="btn btn-primary auth-btn">Send Request to Admin</button>
              <p class="auth-footnote">Already have an account? <button type="button" class="auth-text-button" id="switch-to-sign-in">Sign In</button></p>
            </form>

            <form id="password-reset-request-form" class="auth-body" hidden>
              <div id="password-reset-request-error" class="auth-alert"></div>
              <div class="form-group"><label for="password-reset-email">Account Email</label><input type="email" id="password-reset-email" class="form-input" placeholder="you@denr.gov.ph" required /></div>
              <p class="auth-access-copy">Your request will be sent to an administrator. Once approved, a secure password-reset link will be sent to this email.</p>
              <button type="submit" id="btn-password-reset-request" class="btn btn-primary auth-btn">Request Password Reset</button>
              <p class="auth-footnote"><button type="button" class="auth-text-button" id="password-reset-back">Back to Sign In</button></p>
            </form>
          </div>
        </section>
      </div>
    `;
  },

  bindEvents() {
    const form = document.getElementById('login-form');
    const errBox = document.getElementById('auth-error');
    const submitBtn = document.getElementById('btn-submit');
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('toggle-password');
    const signInTab = document.getElementById('show-sign-in');
    const accessTab = document.getElementById('show-access-request');
    const accessForm = document.getElementById('access-request-form');
    const passwordResetForm = document.getElementById('password-reset-request-form');

    const showMode = (mode) => {
      const signIn = mode === 'sign-in';
      form.hidden = mode !== 'sign-in';
      accessForm.hidden = mode !== 'access';
      passwordResetForm.hidden = mode !== 'reset';
      signInTab.classList.toggle('active', signIn);
      accessTab.classList.toggle('active', !signIn);
      signInTab.setAttribute('aria-selected', String(signIn));
      accessTab.setAttribute('aria-selected', String(!signIn));
    };
    signInTab?.addEventListener('click', () => showMode('sign-in'));
    accessTab?.addEventListener('click', () => showMode('access'));
    document.getElementById('switch-to-sign-in')?.addEventListener('click', () => showMode('sign-in'));
    document.getElementById('show-password-reset')?.addEventListener('click', () => showMode('reset'));
    document.getElementById('password-reset-back')?.addEventListener('click', () => showMode('sign-in'));

    // Password visibility toggle
    toggleBtn?.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = isPassword 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      console.info('Login attempt started for', email);

      try {
        await AuthService.login(email, password);
        let user = await AuthService.getCurrentUser();

        // The profile may take a moment to settle right after sign-in. Retry
        // a few times before declaring the account unusable.
        for (let i = 0; i < 4 && !user; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          user = await AuthService.getCurrentUser();
        }

        if (!user) {
          // Session exists but profile lookup consistently failed / inactive.
          const sessionData = await AuthService.getSessionDebug();
          console.error('Login failed with active session but missing profile.', sessionData);
          throw new Error('Your account is inactive or has no profile. Please contact the administrator.');
        }
        // Audit logging must not prevent a legitimate user from entering the app.
        AuthService.recordSuccessfulLogin(user).catch((auditError) => {
          console.warn('Unable to record successful login activity.', auditError);
        });
        ToastComponent.show(`Welcome back, ${user.fullName}`, 'success');
        MaintenanceService.subscribe();
        // Explicitly navigate (the global onAuthStateChange listener may race
        // and re-route to login before the session is fully settled).
        await Router.navigate(user);
      } catch (err) {
        console.error('Login error:', err);
        const status = err?.status || err?.statusCode;
        const isServerError = status >= 500 || /AuthRetryableFetchError|fetch failed|network|ECONN|Failed to fetch/i.test(err?.message || '');
        let msg;

        if (isServerError) {
          msg = 'Unable to reach the server. The Denr Seed system may be temporarily offline or the database is paused. Please try again in a moment or contact the administrator.';
        } else if (typeof err.message === 'string' && err.message.trim()) {
          msg = err.message;
        } else {
          msg = 'Invalid login credentials. Please check your email and password.';
        }

        errBox.textContent = msg;
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to System';
      }
    });

    accessForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorBox = document.getElementById('access-request-error');
      const button = document.getElementById('btn-access-request');
      errorBox.style.display = 'none';
      button.disabled = true;
      button.textContent = 'Sending request...';
      try {
        await AccessRequestService.submit({
          full_name: document.getElementById('access-name').value,
          email: document.getElementById('access-email').value
        });
        accessForm.reset();
        ToastComponent.show('Access request sent. An administrator will review it.', 'success');
      } catch (error) {
        errorBox.textContent = error.message || 'Unable to send your access request.';
        errorBox.style.display = 'block';
      } finally {
        button.disabled = false;
        button.textContent = 'Send Request to Admin';
      }
    });

    passwordResetForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorBox = document.getElementById('password-reset-request-error');
      const button = document.getElementById('btn-password-reset-request');
      errorBox.style.display = 'none';
      button.disabled = true;
      button.textContent = 'Sending request...';
      try {
        await PasswordResetRequestService.submit(document.getElementById('password-reset-email').value);
        passwordResetForm.reset();
        ToastComponent.show('Password-reset request sent. Please wait for administrator approval.', 'success');
        showMode('sign-in');
      } catch (error) {
        errorBox.textContent = error.message || 'Unable to send your password-reset request.';
        errorBox.style.display = 'block';
      } finally {
        button.disabled = false;
        button.textContent = 'Request Password Reset';
      }
    });
  }
};
