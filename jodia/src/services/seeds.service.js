import { supabase } from '../config/supabase.js';
import { formatQuantity } from '../../utils/formatters.js';

export const SeedsService = {
  getStockStatus(seed) {
    const quantity = this.getAvailableQuantity(seed);
    const alertAt = Number(seed?.reorder_level) || 0;
    if (quantity <= 0) return { key: 'out-of-stock', label: 'Out of Stock' };
    if (quantity <= alertAt) return { key: 'low-stock', label: 'Low Stock' };
    return { key: 'in-stock', label: 'In Stock' };
  },

  formatQuantity(seed) {
    return formatQuantity(this.getAvailableQuantity(seed), seed?.unit || 'packs');
  },

  getAvailableQuantity(seed) {
    return Math.max(0, (Number(seed?.quantity) || 0) - (Number(seed?.reserved_quantity) || 0));
  },

  // Use a calm, consistent fallback when a legacy seed record has no image yet.
  getImageUrl(seed) {
    return seed?.image_url || 'https://images.unsplash.com/photo-1501004318641-b39e6451afbe?auto=format&fit=crop&w=900&q=80';
  },

  // Fetch all seeds inventory
  async getAllSeeds() {
    const { data, error } = await supabase
      .from('seeds')
      .select('*')
      .eq('is_archived', false)
      .order('species_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Add new seed entry
  async addSeed(seedData) {
    const { data, error } = await supabase
      .from('seeds')
      .insert([seedData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update existing seed entry
  async updateSeed(id, updates) {
    const { data, error } = await supabase
      .from('seeds')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Archiving preserves the request history and removes the seed from active
  // inventory and personnel catalog views.
  async archiveSeed(id) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('seeds')
      .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: user?.id || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('is_archived', false);

    if (error) throw error;
  },

  // Used to make archive confirmation clear about linked history.
  async getRequestCount(id) {
    const { count, error } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('seed_id', id);

    if (error) throw error;
    return count || 0;
  },

  // Real-time seed inventory subscription
  subscribeToSeeds(onUpdate) {
    return supabase
      .channel('public:seeds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seeds' }, (payload) => {
        onUpdate(payload);
      })
      .subscribe();
  }
};
