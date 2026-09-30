import { supabase } from '../config/supabase.js';
import { ProfileService } from './profile.service.js';

export const AuthService = {
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
    if (sessionError || !session) return null;

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
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      fullName: profile.full_name,
      role: profile.role,
      requiresPasswordChange: profile.requires_password_change,
      requiresTotpSetup: profile.requires_totp_setup === true,
      activationExpiresAt: profile.activation_expires_at || null,
      activationCompletedAt: profile.activation_completed_at || null,
      recoveryExpiresAt: profile.recovery_expires_at || null,
      department: profile.department || '',
      phone: profile.phone || '',
      office: profile.office || '',
      avatarPath: profile.avatar_path || '',
      avatarUrl: ProfileService.getAvatarUrl(profile.avatar_path)
    };
  },

  // Authenticate user with credentials
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

  async getSessionDebug() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  // Force first-login password update
  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    const { error: setupError } = await supabase.rpc('mark_password_setup_complete');
    if (setupError) throw setupError;

    this.clearPasswordRecovery();

    return data;
  },

  async validateActivationSession() {
    const { data, error } = await supabase.rpc('validate_personnel_activation');
    if (error) throw error;
    return data;
  },

  async validateRecoverySession() {
    const { data, error } = await supabase.rpc('validate_personnel_recovery_code');
    if (error) throw error;
    return data;
  },

  async completePersonnelActivation() {
    const { data, error } = await supabase.rpc('complete_personnel_activation');
    if (error) throw error;
    return data;
  },

  async getMfaState() {
    const [factorsResult, assuranceResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    ]);
    if (factorsResult.error) throw factorsResult.error;
    if (assuranceResult.error) throw assuranceResult.error;
    const factors = factorsResult.data?.totp || [];
    const verifiedFactor = factors.find(factor => factor.status === 'verified') || null;
    return {
      verifiedFactor,
      currentLevel: assuranceResult.data?.currentLevel || 'aal1',
      nextLevel: assuranceResult.data?.nextLevel || 'aal1'
    };
  },

  // Logout session
  async logout() {
    await supabase.auth.signOut();
  }
};
