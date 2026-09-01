import { supabase } from '../config/supabase.js';

export const AccessRequestService = {
  async submit({ email, full_name = null }) {
    const { error } = await supabase
      .from('access_requests')
      .insert([{ email: email.trim().toLowerCase(), full_name: full_name?.trim() || null }]);

    if (error) {
      if (error.code === '23505') throw new Error('An access request for this email is already pending.');
      throw error;
    }
    return true;
  },

  async getPending() {
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('access_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
