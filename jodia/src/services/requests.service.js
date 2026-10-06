import { supabase } from '../config/supabase.js';
import { RequestLetterService } from './request-letter.service.js';

export const RequestsService = {
  // Get all requests (Admin) or user requests (Personnel)
  async getRequests(userId = null) {
    let query = supabase
      .from('requests')
      .select(`
        *,
        seeds ( species_name, scientific_name, category, source_location, image_url, unit, seedlot_no, ipt_no, date_collected, collectors, processing_status ),
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
  async createRequest(seedId, quantityRequested, requestDetails, letterFile = null) {
    const { data: { user } } = await supabase.auth.getUser();
    const quantity = Number(quantityRequested);
    if (!user?.id) throw new Error('Your session has expired. Please sign in again.');
    if (!seedId || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Choose a seed and enter a valid quantity.');
    if (!requestDetails || typeof requestDetails !== 'object') throw new Error('Request details are incomplete.');

    const requestId = crypto.randomUUID();
    // Upload first so a failed upload never creates an incomplete request.
    const letter = letterFile ? await RequestLetterService.upload(letterFile, user.id, requestId) : {};
    const { data, error, status } = await supabase
      .from('requests')
      .insert([{
        id: requestId,
        user_id: user.id,
        seed_id: seedId,
        quantity,
        purpose: String(requestDetails.purpose || '').trim() || null,
        planting_site: String(requestDetails.planting_site || '').trim() || null,
        needed_date: requestDetails.needed_date || null,
        purpose_category: requestDetails.purpose_category,
        beneficiaries_count: requestDetails.beneficiaries_count || null,
        contact_number: String(requestDetails.contact_number || '').trim() || null,
        status: 'PENDING',
        ...letter
      }])
      .select()
      .single();

    if (error) {
      // A lost response may hide a committed request. Do not remove its file.
      if (!status || status >= 500) throw new Error('Submission could not be confirmed. Refresh My Requests before trying again.');
      if (letter.request_letter_path) {
        try {
          await RequestLetterService.removeUnlinked(letter.request_letter_path);
        } catch (cleanupError) {
          throw new Error(`${error.message} The unattached upload could not be removed; please contact an admin.`);
        }
      }
      throw error;
    }
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
    const completed = status === 'PENDING' ? 1 : status === 'APPROVED' ? 2 : status === 'READY_FOR_RELEASE' ? 3 : status === 'RELEASED' ? 4 : 0;
    return steps.map((label, index) => ({ label, complete: index <= completed }));
  },

  subscribeToRequests(onUpdate) {
    return supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, onUpdate)
      .subscribe();
  },

  unsubscribe(channel) {
    if (channel) supabase.removeChannel(channel);
  }
};
