import { supabase } from '../config/supabase.js';
import { ProfileService } from './profile.service.js';

export const AuthService = {
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

    // If the profile could not be fetched (transient), do NOT log out —
    // return null so callers can decide (e.g., show a message) rather than
    // destroying the freshly-created session.
    if (!profile) {
      // Attempt to derive fallback user data from auth metadata when the
      // profiles row is missing. This can happen if the Supabase trigger or
      // database seed is incomplete, but the auth user still exists.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return null;
      }

      const rawMeta = userData.user.raw_user_meta_data || {};
      const fallbackRole = rawMeta.role || 'personnel';
      const fallbackFullName = rawMeta.full_name || session.user.email?.split('@')[0] || 'User';
      const fallbackRequiresPasswordChange = rawMeta.requires_password_change === true;

      return {
        id: session.user.id,
        email: session.user.email,
        fullName: fallbackFullName,
        role: fallbackRole,
        requiresPasswordChange: fallbackRequiresPasswordChange,
        department: '',
        phone: '',
        office: '',
        avatarPath: '',
        avatarUrl: ''
      };
    }

    return {
      id: session.user.id,
      email: session.user.email,
      fullName: profile.full_name,
      role: profile.role,
      requiresPasswordChange: profile.requires_password_change,
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

    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('profiles')
      .update({ requires_password_change: false, updated_at: new Date() })
      .eq('id', user.id);

    return data;
  },

  // Logout session
  async logout() {
    await supabase.auth.signOut();
  }
};
