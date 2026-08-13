import { supabase } from '../config/supabase.js';

export const SeedsService = {
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
