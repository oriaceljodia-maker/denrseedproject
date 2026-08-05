import { supabase } from '../config/supabase.js';

export const AuthService = {
  // Retrieve session user profile and status
  async getCurrentUser() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      await this.logout();
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      fullName: profile.full_name,
      role: profile.role,
      requiresPasswordChange: profile.requires_password_change
    };
  },

  // Authenticate user with credentials
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
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