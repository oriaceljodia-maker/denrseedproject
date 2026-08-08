import { supabase } from '../config/supabase.js';

export const LoginActivityService = {
  async getLoginActivity() {
    const { data, error } = await supabase
      .from('login_activity')
      .select('id, user_id, email, outcome, created_at, profiles(full_name, role)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};
