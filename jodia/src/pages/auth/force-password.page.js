import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ToastComponent } from '../../components/toast.component.js';

export const ForcePasswordPage = {
  render() {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <h1 class="auth-title">Password Reset Required</h1>
            <div class="auth-subtitle">Account Security Protocol</div>
          </div>
          <form id="password-reset-form" class="auth-body">
            <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom: 1.25rem;">
              First-time login detected. Please establish a new secure password to proceed.
            </p>
            
            <div id="reset-error" class="auth-alert"></div>

            <div class="form-group">
              <label for="new-password">New Password</label>
              <input type="password" id="new-password" class="form-input" minlength="8" required placeholder="Minimum 8 characters" />
            </div>

            <div class="form-group">
              <label for="confirm-password">Confirm Password</label>
              <input type="password" id="confirm-password" class="form-input" minlength="8" required placeholder="Re-enter password" />
            </div>

            <button type="submit" id="btn-reset-submit" class="btn btn-primary auth-btn">
              Update Password & Continue
            </button>
          </form>
        </div>
      </div>
    `;
  },

  bindEvents() {
    const form = document.getElementById('password-reset-form');
    const errBox = document.getElementById('reset-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (newPassword !== confirmPassword) {
        errBox.textContent = "Passwords do not match.";
        errBox.style.display = 'block';
        return;
      }

      try {
        await AuthService.updatePassword(newPassword);
        ToastComponent.show('Password updated successfully.', 'success');
        const user = await AuthService.getCurrentUser();
        await Router.navigate(user);
      } catch (err) {
        errBox.textContent = err.message || 'Failed to update password.';
        errBox.style.display = 'block';
      }
    });
  }
};