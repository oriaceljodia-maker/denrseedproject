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
  async createPersonnelActivationAccount(email, fullName, activationCode) {
    const { data, error } = await supabase.rpc('create_personnel_activation_account', {
      user_email: email,
      user_full_name: fullName,
      activation_code: activationCode
    });

    if (error) throw error;
    return data;
  },

  async issuePersonnelRecoveryCode(userId, recoveryCode) {
    const { data, error } = await supabase.rpc('issue_personnel_recovery_code', {
      target_user_id: userId,
      recovery_code: recoveryCode
    });
    if (error) throw error;
    return data;
  }
};
