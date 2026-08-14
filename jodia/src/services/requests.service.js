import { supabase } from '../config/supabase.js';

export const RequestsService = {
  // Get all requests (Admin) or user requests (Personnel)
  async getRequests(userId = null) {
    let query = supabase
      .from('requests')
      .select(`
        *,
        seeds ( species_name, category, image_url ),
        profiles ( full_name )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Submit a seed request
  async createRequest(seedId, quantityRequested, purpose) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('requests')
      .insert([{
        user_id: user.id,
        seed_id: seedId,
        quantity: quantityRequested,
        purpose: purpose,
        status: 'PENDING'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Approve or Reject request (Admin)
  async updateRequestStatus(requestId, status, reviewNotes = '') {
    const { data, error } = await supabase
      .from('requests')
      .update({
        status: status,
        review_notes: reviewNotes,
        updated_at: new Date()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  subscribeToRequests(onUpdate) {
    return supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, onUpdate)
      .subscribe();
  }
};
