import { supabase } from '../config/supabase.js';

export const MaintenanceService = {
  config: { maintenance_enabled: false, announcement_message: '', updated_at: null, updated_by: null },
  channel: null,

  async load() {
    const { data, error } = await supabase
      .from('system_settings')
      .select('maintenance_enabled, announcement_message, updated_at, updated_by, profiles:updated_by(full_name)')
      .eq('id', true)
      .single();
    if (error) throw error;
    this.config = data;
    return data;
  },

  async save({ maintenance_enabled, announcement_message }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('system_settings')
      .update({ maintenance_enabled, announcement_message, updated_at: new Date().toISOString(), updated_by: user?.id || null })
      .eq('id', true)
      .select('maintenance_enabled, announcement_message, updated_at, updated_by, profiles:updated_by(full_name)')
      .single();
    if (error) throw error;
    this.config = data;
    window.dispatchEvent(new CustomEvent('denr-maintenance-changed', { detail: data }));
    return data;
  },

  async isEnabled() {
    const config = await this.load();
    return Boolean(config.maintenance_enabled);
  },

  subscribe() {
    if (this.channel) return this.channel;
    this.channel = supabase
      .channel('public:system_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, async () => {
        try {
          await this.load();
          window.dispatchEvent(new CustomEvent('denr-maintenance-changed', { detail: this.config }));
        } catch (error) {
          console.warn('Unable to refresh maintenance settings.', error);
        }
      })
      .subscribe();
    return this.channel;
  }
};
