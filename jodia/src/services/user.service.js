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

  // Create new user profile record (Triggered post Supabase Auth creation or RPC)
  async createPersonnelAccount(email, fullName, role = 'personnel') {
    // Note: Creating auth users client-side usually requires a dedicated RPC function
    // or Supabase Admin API on a secure backend.
    const { data, error } = await supabase.rpc('create_new_user_account', {
      user_email: email,
      user_full_name: fullName,
      user_role: role
    });

    if (error) throw error;
    return data;
  }
};