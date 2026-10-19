import { AuthService } from '../../services/auth.service.js';
import { MfaService } from '../../services/mfa.service.js';
import { Router } from '../../router/router.js';
import { ROUTES } from '../../config/constants.js';

export const MfaPage = {
  version: 0,

  render() {
    return `
      <main class="auth-layout mfa-layout">
        <section class="auth-card mfa-card" aria-labelledby="mfa-title">
          <div class="auth-header">
            <img src="/assets/images/logs.jpg" alt="DENR logo" class="auth-logo" />
            <h1 id="mfa-title" class="auth-title">Two-step verification</h1>
            <p class="auth-subtitle">Protect your DENR account</p>
          </div>
          <div class="auth-body">
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
    const submit = document.getElementById('mfa-submit');
    const codeInput = document.getElementById('mfa-code');
    const factorSelect = document.getElementById('mfa-factor');
    let factorId = null;
    let busy = false;
    document.getElementById('mfa-account').textContent = user.email;

    const showError = error => {
      errorBox.textContent = error.message || 'Verification is unavailable. Please try again.';
      errorBox.style.display = 'block';
    };
    retry.onclick = () => Router.navigate(user, ROUTES.MFA);
    document.getElementById('mfa-sign-out').onclick = async event => {
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
        const verifiedUser = await AuthService.getCurrentUser();
        if (!current()) return;
        if (!verifiedUser?.mfaVerified) throw new Error('Your session could not be verified. Please sign in again.');
        AuthService.recordSuccessfulLogin(verifiedUser).catch(() => {
          console.warn('Unable to record successful login activity.');
        });
        await Router.navigate(verifiedUser, ROUTES.LOGIN);
      } catch (error) {
        if (current()) {
          showError(error);
          codeInput.value = '';
          codeInput.focus();
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
        await Router.navigate(await AuthService.getCurrentUser(), ROUTES.LOGIN);
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
        statusText.textContent = 'Connect Google Authenticator to continue. This is required for all admin and personnel accounts.';
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
      statusText.textContent = 'Authenticator setup could not be prepared.';
      showError(error);
      retry.hidden = false;
    }
  },

  dispose() {
    this.version++;
  }
};
