import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ToastComponent } from '../../components/toast.component.js';

export const LoginPage = {
  render() {
    return `
      <div class="auth-layout">
        <section class="auth-hero">
          <div class="auth-hero-copy">
            <span class="eyebrow">Secure Seed Management</span>
            <h1>DENR Seed Inventory & Distribution</h1>
            <p>Access inventory, submit seed requests, and manage approvals with a streamlined system designed for Philippine forestry operations.</p>
            <div class="hero-features">
              <span>Inventory control</span>
              <span>Request tracking</span>
              <span>Role-based access</span>
            </div>
          </div>

          <div class="auth-card">
            <div class="auth-header">
              <img src="/assets/images/denr-logo.png" alt="DENR Logo" class="auth-logo" onerror="this.onerror=null; this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Department_of_Environment_and_Natural_Resources_%28DENR%29.svg/1200px-Department_of_Environment_and_Natural_Resources_%28DENR%29.svg.png';" />
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
                <input type="password" id="password" class="form-input" placeholder="••••••••" required />
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
