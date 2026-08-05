import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ToastComponent } from '../../components/toast.component.js';

export const ForcePasswordPage = {
  render() {
    return `
      <div class="auth-layout">
        <section class="auth-hero auth-hero-simple">
          <div class="auth-hero-copy">
            <span class="eyebrow">Account Protection</span>
            <h1>Secure Password Setup</h1>
            <p>Complete your first-time sign-in by setting a strong password for continued access.</p>
          </div>

          <div class="auth-card">
            <div class="auth-header">
              <h1 class="auth-title">Set Your New Password</h1>
              <div class="auth-subtitle">Required before continuing</div>
            </div>
            <form id="password-reset-form" class="auth-body">
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
        </section>
      </div>
    `;
  },

  bindEvents() {
    const form = document.getElementById('password-reset-form');
    const errBox = document.getElementById('reset-error');
    const submitBtn = document.getElementById('btn-reset-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';
      console.info('Password update initiated for authenticated user');

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (newPassword !== confirmPassword) {
        errBox.textContent = "Passwords do not match.";
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password & Continue';
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
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password & Continue';
      }
    });
  }
};