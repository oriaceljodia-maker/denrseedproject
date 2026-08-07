import { supabase } from '../config/supabase.js';

const AVATAR_BUCKET = 'profile-avatars';

export const ProfileService = {
  getAvatarUrl(avatarPath) {
    if (!avatarPath) return '';
    return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath).data.publicUrl;
  },

  async updateProfile(userId, details, avatarFile = null) {
    let avatarPath = details.avatarPath || null;

    if (avatarFile) {
      const extension = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      avatarPath = `${userId}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(avatarPath, avatarFile, {
          upsert: true,
          cacheControl: '3600',
          contentType: avatarFile.type
        });

      if (uploadError) throw uploadError;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: details.fullName,
        department: details.department || null,
        phone: details.phone || null,
        office: details.office || null,
        avatar_path: avatarPath,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
