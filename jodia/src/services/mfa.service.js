import { supabase } from '../config/supabase.js';

// Setup secrets live only in memory. Never save QR codes, secrets or OTPs in
// localStorage, sessionStorage, profile rows, logs or third-party QR services.
export const MfaService = {
  pendingEnrollment: null,
  enrollmentPromise: null,
  generation: 0,

  async getStatus() {
    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) throw factorError;
    const { data: assurance, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    const totp = (factors?.totp || []).filter(factor => factor.status === 'verified');
    return {
      verified: assurance?.currentLevel === 'aal2' && totp.length > 0,
      factors: totp,
      needsEnrollment: totp.length === 0
    };
  },

  async beginEnrollment(userId) {
    if (this.pendingEnrollment?.userId === userId) return this.pendingEnrollment;
    if (this.enrollmentPromise) return this.enrollmentPromise;
    const promise = this.createEnrollment(userId, this.generation);
    this.enrollmentPromise = promise;
    try {
      return await promise;
    } finally {
      if (this.enrollmentPromise === promise) this.enrollmentPromise = null;
    }
  },

  async createEnrollment(userId, generation) {
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    if ((factors?.totp || []).some(factor => factor.status === 'verified')) {
      throw new Error('An authenticator is already connected. Reload this page to enter its code.');
    }
    // A refresh cannot recover an unverified factor's secret. Remove only
    // unfinished TOTP enrollments, then present a new QR code to scan.
    for (const factor of factors?.all || []) {
      if (factor.factor_type !== 'totp' || factor.status !== 'unverified') continue;
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'DENR Talipan Authenticator',
      issuer: 'DENR Talipan'
    });
    if (error) throw error;
    if (!data?.id || !data.totp?.secret || !data.totp?.qr_code) {
      throw new Error('Authenticator setup is unavailable. Please try again.');
    }
    if (generation !== this.generation) throw new Error('Setup was cancelled. Please sign in again.');
    this.pendingEnrollment = { userId, factorId: data.id, ...data.totp };
    return this.pendingEnrollment;
  },

  qrImageSource(qr) {
    // SDK versions may return either an SVG or a ready-to-use data URL.
    if (typeof qr !== 'string') throw new Error('The setup QR code is unavailable.');
    if (qr.startsWith('data:image/svg+xml')) {
      const comma = qr.indexOf(',');
      if (comma < 0) throw new Error('The setup QR code is unavailable.');
      const payload = qr.slice(comma + 1);
      // auth-js prefixes raw SVG without percent-encoding it. Encode the
      // payload so SVG color hashes cannot become a URL fragment.
      return payload.trim().startsWith('<')
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(payload)}`
        : qr;
    }
    if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(qr.trim())) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
    }
    throw new Error('The setup QR code could not be displayed. Use the setup key instead.');
  },

  async verify(factorId, code) {
    if (!factorId || !/^\d{6}$/.test(code)) {
      throw new Error('Enter the six-digit code from Google Authenticator.');
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
    const status = await this.getStatus();
    if (!status.verified) throw new Error('Verification is incomplete. Please try a new code.');
    this.clear();
    return status;
  },

  clear() {
    this.pendingEnrollment = null;
    this.enrollmentPromise = null;
    this.generation++;
  }
};
