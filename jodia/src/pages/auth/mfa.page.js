import { AuthService } from '../../services/auth.service.js';
import { MfaService } from '../../services/mfa.service.js';
import { Router } from '../../router/router.js';
import { ROUTES } from '../../config/constants.js';
import { AccountSetupStepsComponent } from '../../components/account-setup-steps.component.js';

export const MfaPage = {
  version: 0,

  render(user) {
    return `
      <main class="auth-layout mfa-layout">
        <section class="auth-card mfa-card" aria-labelledby="mfa-title">
          <div class="auth-header">
            <img src="/assets/images/logs.jpg" alt="DENR logo" class="auth-logo" />
            <h1 id="mfa-title" class="auth-title">Two-step verification</h1>
            <p class="auth-subtitle">Protect your DENR account</p>
          </div>
          <div class="auth-body">
            ${user?.passwordSetupReady ? `<div id="account-setup-progress">${AccountSetupStepsComponent.render(2)}</div>` : ''}
            <p id="mfa-account" class="mfa-account"></p>
            <p id="mfa-status" role="status">Preparing your authenticator…</p>
            <div id="mfa-error" class="auth-alert" role="alert"></div>
            <section id="mfa-enrollment" hidden>
              <ol class="mfa-instructions">
                <li>Open Google Authenticator on your phone.</li>
                <li>Tap +, choose Scan a QR code, then scan below.</li>
                <li>Enter the six-digit code shown in the app.</li>
              </ol>
              <div class="mfa-qr-wrap"><img id="mfa-qr" alt="Scan this QR code with Google Authenticator" width="220" height="220" /></div>
              <details class="mfa-manual-setup">
                <summary>Cannot scan? Use a setup key</summary>
                <p>In Google Authenticator, choose Enter a setup key. Use your email as the account name, paste this key and select Time based.</p>
                <code id="mfa-setup-key" class="mfa-setup-key"></code>
                <p>Keep this key private. It is not the six-digit verification code.</p>
              </details>
              <p class="mfa-help">If you reload during setup, scan the new QR code before entering a code.</p>
            </section>
            <form id="mfa-form" hidden>
              <div id="mfa-factor-choice" class="form-group" hidden>
                <label for="mfa-factor">Authenticator</label>
                <select id="mfa-factor" class="form-input"></select>
              </div>
              <div class="form-group">
                <label for="mfa-code">Authenticator code</label>
                <input id="mfa-code" class="form-input mfa-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="000000" aria-describedby="mfa-code-help" required />
                <p id="mfa-code-help" class="mfa-help">Enter the six-digit code from Google Authenticator, not an email code or your setup key.</p>
              </div>
              <button id="mfa-submit" class="btn btn-primary auth-btn" type="submit">Verify and continue</button>
            </form>
            <button id="mfa-retry" class="btn btn-secondary auth-btn" type="button" hidden>Try again</button>
            <button id="mfa-change-password" class="auth-text-button" type="button" hidden>Back to Step 1: choose another password</button>
            <p class="mfa-help">Lost access to your authenticator? Contact your administrator for identity verification and recovery.</p>
            <button id="mfa-sign-out" class="auth-text-button" type="button">Cancel and sign out</button>
          </div>
        </section>
      </main>`;
  },

  async init(user) {
    const version = ++this.version;
    const form = document.getElementById('mfa-form');
    const current = () => this.version === version && form.isConnected;
    const statusText = document.getElementById('mfa-status');
    const errorBox = document.getElementById('mfa-error');
    const retry = document.getElementById('mfa-retry');
    const changePassword = document.getElementById('mfa-change-password');
    const submit = document.getElementById('mfa-submit');
    const codeInput = document.getElementById('mfa-code');
    const factorSelect = document.getElementById('mfa-factor');
    let factorId = null;
    let busy = false;
    let authenticatorVerified = false;
    document.getElementById('mfa-account').textContent = user.email;
    changePassword.hidden = !user.passwordSetupReady;

    const showError = error => {
      errorBox.textContent = error.message || 'Verification is unavailable. Please try again.';
      errorBox.style.display = 'block';
    };
    const showCompletionError = error => {
      showError(error);
      retry.hidden = false;
      retry.textContent = authenticatorVerified ? 'Continue setup' : 'Try again';
      if (authenticatorVerified) statusText.textContent = 'Authenticator verified. Account setup still needs to finish.';
    };

    const finishAccess = async recordLogin => {
      let verifiedUser = await AuthService.getCurrentUser();
      if (!current()) return;
      if (!verifiedUser?.mfaVerified) throw new Error('Your session could not be verified. Please sign in again.');
      if (verifiedUser.passwordSetupReady) {
        statusText.textContent = 'Authenticator verified. Saving your new password…';
        // The form owns navigation; USER_UPDATED must not interrupt saving.
        sessionStorage.setItem('denr-password-update-in-progress', 'true');
        try {
          await AuthService.completePasswordSetup();
        } finally {
          sessionStorage.removeItem('denr-password-update-in-progress');
        }
        verifiedUser = await AuthService.getCurrentUser();
        if (!current()) return;
        if (!verifiedUser?.mfaVerified) throw new Error('Please sign in again using your new password.');
        if (verifiedUser.requiresPasswordChange) throw new Error('Your password was saved, but account setup is still pending. Please try again.');
        const progress = document.getElementById('account-setup-progress');
        if (progress) progress.innerHTML = AccountSetupStepsComponent.render(3);
      }
      if (recordLogin) {
        AuthService.recordSuccessfulLogin(verifiedUser).catch(() => {
          console.warn('Unable to record successful login activity.');
        });
      }
      statusText.textContent = 'Opening your dashboard…';
      await Router.navigate(verifiedUser, ROUTES.LOGIN);
    };

    retry.onclick = async () => {
      if (busy) return;
      busy = true;
      retry.disabled = true;
      try {
        const latestUser = await AuthService.getCurrentUser();
        if (current()) await Router.navigate(latestUser, ROUTES.MFA);
      } catch (error) {
        if (current()) showCompletionError(error);
      } finally {
        busy = false;
        retry.disabled = false;
      }
    };
    changePassword.onclick = async () => {
      if (busy) return;
      busy = true;
      changePassword.disabled = true;
      try {
        AuthService.clearPasswordSetup();
        const latestUser = await AuthService.getCurrentUser();
        if (current()) await Router.navigate(latestUser, ROUTES.FORCE_PASSWORD);
      } catch (error) {
        if (current()) showError(error);
      } finally {
        busy = false;
        changePassword.disabled = false;
      }
    };
    document.getElementById('mfa-sign-out').onclick = async event => {
      if (busy) return;
      event.currentTarget.disabled = true;
      try {
        await AuthService.logout();
        await Router.navigate(null, ROUTES.LOGIN);
      } catch (error) {
        if (current()) showError(error);
        event.target.disabled = false;
      }
    };
    codeInput.oninput = () => { codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6); };
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy || !factorId) return;
      busy = true;
      submit.disabled = true;
      submit.textContent = 'Verifying…';
      errorBox.style.display = 'none';
      try {
        await MfaService.verify(factorSelect.value || factorId, codeInput.value.trim());
        if (!current()) return;
        authenticatorVerified = true;
        codeInput.value = '';
        form.hidden = true;
        document.getElementById('mfa-enrollment').hidden = true;
        await finishAccess(true);
      } catch (error) {
        if (current()) {
          if (authenticatorVerified) showCompletionError(error);
          else showError(error);
          codeInput.value = '';
          if (!authenticatorVerified) codeInput.focus();
        }
      } finally {
        busy = false;
        submit.disabled = false;
        submit.textContent = 'Verify and continue';
      }
    };

    try {
      const status = await MfaService.getStatus();
      if (!current()) return;
      if (status.verified) {
        authenticatorVerified = true;
        busy = true;
        try { await finishAccess(Boolean(user.passwordSetupReady)); }
        finally { busy = false; }
        return;
      }
      if (status.needsEnrollment) {
        const setup = await MfaService.beginEnrollment(user.id);
        if (!current()) return;
        factorId = setup.factorId;
        document.getElementById('mfa-title').textContent = 'Set up your authenticator';
        document.getElementById('mfa-enrollment').hidden = false;
        document.getElementById('mfa-setup-key').textContent = setup.secret;
        const qr = document.getElementById('mfa-qr');
        qr.onerror = () => {
          qr.hidden = true;
          if (current()) showError(new Error('The QR image could not load. Open “Cannot scan?” below and use the setup key.'));
        };
        try { qr.src = MfaService.qrImageSource(setup.qr_code); }
        catch (error) { qr.hidden = true; showError(error); }
        statusText.textContent = 'Connect Google Authenticator, then enter its code to finish securely. This is required for all admin and personnel accounts.';
      } else {
        factorId = status.factors[0].id;
        statusText.textContent = 'Open Google Authenticator and enter the code for your DENR account.';
        for (const factor of status.factors) {
          const option = document.createElement('option');
          option.value = factor.id;
          option.textContent = factor.friendly_name || 'Authenticator';
          factorSelect.appendChild(option);
        }
        document.getElementById('mfa-factor-choice').hidden = status.factors.length < 2;
      }
      form.hidden = false;
      codeInput.focus();
    } catch (error) {
      if (!current()) return;
      if (!authenticatorVerified) statusText.textContent = 'Authenticator setup could not be prepared.';
      showCompletionError(error);
    }
  },

  dispose() {
    this.version++;
  }
};
