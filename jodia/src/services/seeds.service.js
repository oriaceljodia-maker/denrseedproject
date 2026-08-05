import { supabase } from '../config/supabase.js';

export const SeedsService = {
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