import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ToastComponent } from '../../components/toast.component.js';

export const LoginPage = {
  render() {
    return `
      <div class="auth-layout">
        <section class="auth-hero">
          <div class="auth-hero-copy">
            <span class="eyebrow">DENR field operations</span>
            <h1>Stewardship for resilient forests and thriving nurseries</h1>
            <p>Access inventory, submit seed requests, and coordinate approval workflows with a streamlined platform built for Philippine environmental management teams.</p>
            <div class="hero-features">
              <span>Inventory visibility</span>
              <span>Fast approvals</span>
              <span>Mission-ready access</span>
            </div>
            <div class="hero-highlight-card">
              <img src="https://images.unsplash.com/photo-1501004318641-b39e6451afbe?auto=format&fit=crop&w=800&q=80" alt="DENR field team" />
              <div>
                <strong>Purpose-built for conservation</strong>
                <p>Every request supports reforestation, biodiversity, and long-term ecosystem recovery.</p>
              </div>
            </div>
          </div>

          <div class="auth-card">
            <div class="auth-header">
              <img src="/assets/images/logs.jpg" alt="DENR logo" class="auth-logo" />
              <h1 class="auth-title">Welcome Back</h1>
              <div class="auth-subtitle">Sign in to continue</div>
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

              <button type="submit" id="btn-submit" class="btn btn-primary auth-btn">
                Sign In to System
              </button>

              <p class="auth-footnote">Need help? Contact the administrator if your account is inactive or unregistered.</p>
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
  }
};
