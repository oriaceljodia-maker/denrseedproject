import { supabase } from '../config/supabase.js';
import { ProfileService } from './profile.service.js';
import { MfaService } from './mfa.service.js';

// First-login/recovery passwords stay in this tab's memory until MFA succeeds.
// Never put them in storage, URLs, profile rows, logs or email.
let pendingPasswordSetup = null;

export const AuthService = {
  clearPasswordSetup() {
    if (pendingPasswordSetup) pendingPasswordSetup.password = null;
    pendingPasswordSetup = null;
  },

  preparePasswordSetup(userId, password) {
    this.clearPasswordSetup();
    if (!userId) throw new Error('Your session has expired. Please sign in again.');
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Choose a password with at least 8 characters.');
    }
    pendingPasswordSetup = { userId, password, passwordSaved: false };
  },

  async completePasswordSetup() {
    if (!pendingPasswordSetup) throw new Error('Please return to Step 1 and enter your new password again.');
    const setup = pendingPasswordSetup;
    // Back/forward or a route refresh must not save the same password twice.
    if (!setup.completion) {
      setup.completion = this.updatePassword(setup.password).then(() => {
        if (pendingPasswordSetup === setup) this.clearPasswordSetup();
      }).finally(() => { setup.completion = null; });
    }
    await setup.completion;
  },

  isPasswordRecoveryLink() {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return search.get('type') === 'recovery' || hash.get('type') === 'recovery';
  },

  beginPasswordRecovery() {
    sessionStorage.setItem('denr-password-recovery', 'true');
  },

  clearPasswordRecovery() {
    sessionStorage.removeItem('denr-password-recovery');
  },

  // Retrieve session user profile and status
  async getCurrentUser() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      this.clearPasswordSetup();
      return null;
    }
    if (pendingPasswordSetup && pendingPasswordSetup.userId !== session.user.id) this.clearPasswordSetup();

    // Retry the profile lookup a few times. Immediately after sign-in the
    // session may be present but the profile query can still be settling
    // (e.g., the on_auth_user_created trigger or Row Level Security cache).
    // Calling logout() here would kill the session the user just created,
    // leaving them stuck on the login page.
    let profile = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!error && data) {
        profile = data;
        break;
      }

      if (error?.code === '42P17') {
        throw new Error('Your account could not be loaded because of a system access configuration error. Please contact your administrator.');
      }

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    // Only log out if we definitively know the profile exists but is inactive.
    if (profile && !profile.is_active) {
      await this.logout();
      return null;
    }

    // Never derive a role from auth metadata. Browser-controlled metadata must
    // not become an authorization fallback. A signed-in account without a
    // verified profile is treated as unavailable until the database profile is
    // created and can be read through RLS.
    if (!profile) {
      this.clearPasswordSetup();
      return null;
    }

    // The profile's own SELECT stays available before MFA for account status
    // and routing. Portal data is protected separately by restrictive RLS.
    const mfa = await MfaService.getStatus();
    return {
      id: session.user.id,
      email: session.user.email,
      fullName: profile.full_name,
      role: profile.role,
      requiresPasswordChange: profile.requires_password_change,
      passwordSetupReady: pendingPasswordSetup?.userId === session.user.id,
      mfaVerified: mfa.verified,
      department: profile.department || '',
      phone: profile.phone || '',
      office: profile.office || '',
      avatarPath: profile.avatar_path || '',
      avatarUrl: ProfileService.getAvatarUrl(profile.avatar_path)
    };
  },

  // Authenticate user with credentials
  async login(email, password) {
    this.clearPasswordSetup();
    MfaService.clear();
    this.clearPasswordRecovery();
    this.signInInProgress = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } finally {
      this.signInInProgress = false;
    }
  },

  // Supabase sends a one-time recovery link; no password is exposed to the application.
  async sendPasswordResetEmail(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/force-password`
    });
    if (error) throw error;
    return data;
  },

  // Audit successful sign-ins only. Passwords, tokens, and failed credential
  // attempts are intentionally never stored by the browser application.
  async recordSuccessfulLogin(user) {
    if (!user?.id) return;

    const { error } = await supabase
      .from('login_activity')
      .insert({ user_id: user.id, email: user.email, outcome: 'SUCCESS' });

    if (error) throw error;
  },

  // Force first-login password update
  async updatePassword(newPassword) {
    const setup = pendingPasswordSetup;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Your session has expired. Please sign in again.');

    // Native Supabase password changes for enrolled accounts require AAL2.
    // Keep that protection: collect first, but save only after verification.
    const mfa = await MfaService.getStatus();
    if (!mfa.verified) throw new Error('Verify your authenticator before saving your new password.');
    if (setup && (setup !== pendingPasswordSetup || setup.userId !== user.id)) {
      throw new Error('Account setup changed. Please start again from Step 1.');
    }

    let data = { user };
    if (!setup?.passwordSaved) {
      const result = await supabase.auth.updateUser({ password: newPassword });
      if (result.error) throw result.error;
      data = result.data;
      if (setup) {
        // A profile-write retry must not submit an already accepted password.
        setup.passwordSaved = true;
        setup.password = null;
      }
    }
    if (setup && setup !== pendingPasswordSetup) throw new Error('Setup was cancelled. Sign in using your new password.');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ requires_password_change: false, updated_at: new Date() })
      .eq('id', user.id)
      .select('id')
      .single();

    if (profileError) throw new Error('Your password changed, but account setup could not be saved. Choose Continue setup to retry. Use your NEW password if you sign in again; contact your administrator if this continues.');

    this.clearPasswordRecovery();

    return data;
  },

  // Logout session
  async logout() {
    this.clearPasswordSetup();
    MfaService.clear();
    this.clearPasswordRecovery();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};
