import { supabase } from '../../config/supabase.js';
import { AuthService } from '../../services/auth.service.js';
import { Router } from '../../router/router.js';
import { ROUTES } from '../../config/constants.js';

const errorMessage = (error) => error?.message || 'Unable to verify the authenticator code. Please try again.';

export const TotpSetupPage = {
  factorId: null,
  render() {
    return `
      <div class="auth-layout">
        <section class="auth-hero auth-hero-simple">
          <div class="auth-hero-copy">
            <span class="eyebrow">Account Protection</span>
            <h1>Set up your authenticator</h1>
            <p>Use Google Authenticator, Microsoft Authenticator, or another TOTP app. This is required before your personnel account can access the portal.</p>
          </div>
          <div class="auth-card auth-totp-card">
            <div class="auth-header">
              <img src="/assets/images/logs.jpg" alt="DENR logo" class="auth-logo" />
              <h1 class="auth-title">Two-step verification</h1>
              <div class="auth-subtitle">Scan, then enter the six-digit code</div>
            </div>
            <form id="totp-setup-form" class="auth-body">
              <div id="totp-setup-error" class="auth-alert"></div>
              <div id="totp-qr-area" class="totp-qr-area"><p>Preparing your secure QR code…</p></div>
              <p class="auth-access-copy">If scanning does not work, use the setup key shown below in your authenticator app.</p>
              <code id="totp-secret" class="totp-secret" hidden></code>
              <div class="form-group"><label for="totp-setup-code">Authenticator code</label><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" id="totp-setup-code" class="form-input" placeholder="000000" required /></div>
              <button type="submit" id="btn-totp-setup" class="btn btn-primary auth-btn">Verify and activate account</button>
              <p class="auth-footnote"><button type="button" class="auth-text-button" id="totp-setup-signout">Cancel and sign out</button></p>
            </form>
          </div>
        </section>
      </div>`;
  },

  async bindEvents() {
    const errorBox = document.getElementById('totp-setup-error');
    const qrArea = document.getElementById('totp-qr-area');
    const secret = document.getElementById('totp-secret');
    const form = document.getElementById('totp-setup-form');
    const button = document.getElementById('btn-totp-setup');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'DENR Personnel Portal' });
      if (error) throw error;
      this.factorId = data.id;
      const qr = data.totp?.qr_code;
      qrArea.innerHTML = qr ? `<img src="data:image/svg+xml;utf8,${encodeURIComponent(qr)}" alt="Authenticator setup QR code" />` : '<p>QR code unavailable. Use the setup key below.</p>';
      secret.textContent = data.totp?.secret || '';
      secret.hidden = !data.totp?.secret;
    } catch (error) {
      errorBox.textContent = errorMessage(error);
      errorBox.style.display = 'block';
      button.disabled = true;
    }

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      errorBox.style.display = 'none';
      button.disabled = true;
      button.textContent = 'Verifying…';
      try {
        const challenge = await supabase.auth.mfa.challenge({ factorId: this.factorId });
        if (challenge.error) throw challenge.error;
        const verify = await supabase.auth.mfa.verify({
          factorId: this.factorId,
          challengeId: challenge.data.id,
          code: document.getElementById('totp-setup-code').value.trim()
        });
        if (verify.error) throw verify.error;
        let user = await AuthService.getCurrentUser();
        if (user?.activationExpiresAt && !user.activationCompletedAt) {
          await AuthService.completePersonnelActivation();
          user = await AuthService.getCurrentUser();
        }
        await Router.navigate(user, ROUTES.PERSONNEL_DASHBOARD);
      } catch (error) {
        errorBox.textContent = errorMessage(error);
        errorBox.style.display = 'block';
        button.disabled = false;
        button.textContent = 'Verify and activate account';
      }
    });
    document.getElementById('totp-setup-signout')?.addEventListener('click', async () => {
      await AuthService.logout();
      await Router.navigate(null, ROUTES.LOGIN);
    });
  }
};

export const TotpVerifyPage = {
  render() {
    return `
      <div class="auth-layout">
        <section class="auth-hero auth-hero-simple">
          <div class="auth-hero-copy">
            <span class="eyebrow">Account Protection</span>
            <h1>Verify your sign-in</h1>
            <p>Enter the current six-digit code from your authenticator app to continue to the Personnel Portal.</p>
          </div>
          <div class="auth-card">
            <div class="auth-header">
              <img src="/assets/images/logs.jpg" alt="DENR logo" class="auth-logo" />
              <h1 class="auth-title">Two-step verification</h1>
              <div class="auth-subtitle">Authenticator code required</div>
            </div>
            <form id="totp-verify-form" class="auth-body">
              <div id="totp-verify-error" class="auth-alert"></div>
              <div class="form-group"><label for="totp-verify-code">Authenticator code</label><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" id="totp-verify-code" class="form-input" placeholder="000000" required autofocus /></div>
              <button type="submit" id="btn-totp-verify" class="btn btn-primary auth-btn">Verify and continue</button>
              <p class="auth-footnote"><button type="button" class="auth-text-button" id="totp-verify-signout">Sign out</button></p>
            </form>
          </div>
        </section>
      </div>`;
  },

  async bindEvents() {
    const form = document.getElementById('totp-verify-form');
    const errorBox = document.getElementById('totp-verify-error');
    const button = document.getElementById('btn-totp-verify');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      errorBox.style.display = 'none';
      button.disabled = true;
      button.textContent = 'Verifying…';
      try {
        const state = await AuthService.getMfaState();
        if (!state.verifiedFactor) throw new Error('No verified authenticator is registered. Contact an administrator.');
        const challenge = await supabase.auth.mfa.challenge({ factorId: state.verifiedFactor.id });
        if (challenge.error) throw challenge.error;
        const verify = await supabase.auth.mfa.verify({
          factorId: state.verifiedFactor.id,
          challengeId: challenge.data.id,
          code: document.getElementById('totp-verify-code').value.trim()
        });
        if (verify.error) throw verify.error;
        const user = await AuthService.getCurrentUser();
        await Router.navigate(user, ROUTES.PERSONNEL_DASHBOARD);
      } catch (error) {
        errorBox.textContent = errorMessage(error);
        errorBox.style.display = 'block';
        button.disabled = false;
        button.textContent = 'Verify and continue';
      }
    });
    document.getElementById('totp-verify-signout')?.addEventListener('click', async () => {
      await AuthService.logout();
      await Router.navigate(null, ROUTES.LOGIN);
    });
  }
};
