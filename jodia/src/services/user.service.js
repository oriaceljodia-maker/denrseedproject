import { supabase } from '../config/supabase.js';

export const UserService = {
  // Fetch all user accounts (Admin view)
  async getAllUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Toggle user activation state
  async toggleUserStatus(userId, isActive) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: isActive, updated_at: new Date() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Create new user account (auth user + profile via on_auth_user_created trigger)
  // NOTE: create_new_user_account RPC must be exposed to the 'authenticated' role
  // with EXECUTE privilege for the anon/authenticated key to call it. It inserts
  // into auth.users (SECURITY DEFINER) and the trigger auto-creates the profile.
  async createPersonnelAccount(email, fullName, role = 'personnel', password = null) {
    const { data, error } = await supabase.rpc('create_new_user_account', {
      user_email: email,
      user_full_name: fullName,
      user_role: role,
      user_password: password
    });

    if (error) throw error;
    return data;
  }
};