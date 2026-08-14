import { supabase } from '../config/supabase.js';

export const LoginActivityService = {
  async getLoginActivity() {
    const { data, error } = await supabase
      .from('login_activity')
      .select('id, user_id, email, outcome, created_at, profiles(full_name, role)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async clearLoginActivity() {
    const { error } = await supabase
      .from('login_activity')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
  }
};
