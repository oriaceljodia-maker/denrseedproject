import { supabase } from '../config/supabase.js';

export const SeedsService = {
  getStockStatus(seed) {
    const quantity = this.getAvailableQuantity(seed);
    const alertAt = Number(seed?.reorder_level) || 0;
    if (quantity <= 0) return { key: 'out-of-stock', label: 'Out of Stock' };
    if (quantity <= alertAt) return { key: 'low-stock', label: 'Low Stock' };
    return { key: 'in-stock', label: 'In Stock' };
  },

  formatQuantity(seed) {
    return `${this.getAvailableQuantity(seed)} ${seed?.unit || 'packs'}`;
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

  // Permanently remove a seed entry. Related requests are removed by the
  // database foreign-key cascade configured for requests.seed_id.
  async deleteSeed(id) {
    const { error } = await supabase
      .from('seeds')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Used to make the delete confirmation clear about linked requests that
  // PostgreSQL will remove through the existing ON DELETE CASCADE rule.
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
