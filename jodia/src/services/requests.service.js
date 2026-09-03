import { supabase } from '../config/supabase.js';

export const RequestsService = {
  // Get all requests (Admin) or user requests (Personnel)
  async getRequests(userId = null) {
    let query = supabase
      .from('requests')
      .select(`
        *,
        seeds ( species_name, scientific_name, category, image_url, unit ),
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
  async createRequest(seedId, quantityRequested, requestDetails) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('requests')
      .insert([{
        user_id: user.id,
        seed_id: seedId,
        quantity: quantityRequested,
        purpose: requestDetails.purpose,
        planting_site: requestDetails.planting_site,
        needed_date: requestDetails.needed_date || null,
        purpose_category: requestDetails.purpose_category,
        beneficiaries_count: requestDetails.beneficiaries_count || null,
        contact_number: requestDetails.contact_number,
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

  async cancelOwnRequest(requestId) {
    const { data, error } = await supabase
      .from('requests')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'PENDING')
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getTimeline(status) {
    const steps = ['Submitted', 'Under Review', 'Approved', 'Ready for Release', 'Released'];
    if (status === 'REJECTED') return [...steps.slice(0, 2), 'Rejected'];
    if (status === 'CANCELLED') return [{ label: 'Submitted', complete: true }, { label: 'Cancelled by requester', complete: true }];
    const completed = status === 'PENDING' ? 1 : status === 'APPROVED' ? 2 : status === 'READY_FOR_RELEASE' ? 3 : status === 'DISBURSED' ? 4 : 0;
    return steps.map((label, index) => ({ label, complete: index <= completed }));
  },

  subscribeToRequests(onUpdate) {
    return supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, onUpdate)
      .subscribe();
  }
};
