import { supabase } from '../config/supabase.js';

export const PasswordResetRequestService = {
  async submit(email) {
    const { error } = await supabase
      .from('password_reset_requests')
      .insert([{ email: email.trim().toLowerCase() }]);
    if (error) {
      if (error.code === '23505') throw new Error('A password-reset request for this email is already pending.');
      throw error;
    }
  },

  async getPending() {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'PENDING')
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async markSent(id) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('password_reset_requests')
      .update({ status: 'SENT', reviewed_at: new Date().toISOString(), reviewed_by: user?.id || null })
      .eq('id', id)
      .eq('status', 'PENDING')
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async decline(id) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('password_reset_requests')
      .update({ status: 'DECLINED', reviewed_at: new Date().toISOString(), reviewed_by: user?.id || null })
      .eq('id', id)
      .eq('status', 'PENDING')
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
