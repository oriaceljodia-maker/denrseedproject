import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ToastComponent } from '../../components/toast.component.js';

export const LoginPage = {
  render() {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <img src="/assets/images/denr-logo.png" alt="DENR Logo" class="auth-logo" onerror="this.onerror=null; this.src='https://upload.wikimedia.org/wikipedia/commons/ thumb/8/8c/Department_of_Environment_and_Natural_Resources_%28DENR%29.svg/1200px-Department_of_Environment_and_Natural_Resources_%28DENR%29.svg.png';" />
            <h1 class="auth-title">Department of Environment and Natural Resources</h1>
            <div class="auth-subtitle">Seed Inventory & Management System</div>
          </div>
          <form id="login-form" class="auth-body">
            <div id="auth-error" class="auth-alert"></div>
            
            <div class="form-group">
              <label for="email">User Email</label>
              <input type="email" id="email" class="form-input" placeholder="user@denr.gov.ph" required />
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" class="form-input" placeholder="••••••••" required />
            </div>

            <button type="submit" id="btn-submit" class="btn btn-primary auth-btn">
              Sign In to System
            </button>
          </form>
        </div>
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

      try {
        await AuthService.login(email, password);
        const user = await AuthService.getCurrentUser();
        ToastComponent.show(`Welcome back, ${user.fullName}`, 'success');
        await Router.navigate(user);
      } catch (err) {
        errBox.textContent = err.message || 'Invalid login credentials.';
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to System';
      }
    });
  }
};