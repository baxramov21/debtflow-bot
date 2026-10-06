import { supabaseAdmin } from '../lib/supabaseAdmin';

/**
 * Custom Storage Adapter for grammY using Supabase
 */
export function supabaseStorage(botClinicId) {
  return {
    read: async (key) => {
      // Scope keys to the clinic so multiple bots don't collide on same user ID
      const scopedKey = `${botClinicId}:${key}`;
      const { data, error } = await supabaseAdmin
        .from('bot_sessions')
        .select('value')
        .eq('key', scopedKey)
        .single();
        
      if (error || !data) return undefined;
      return data.value;
    },
    write: async (key, value) => {
      const scopedKey = `${botClinicId}:${key}`;
      await supabaseAdmin
        .from('bot_sessions')
        .upsert({ 
          key: scopedKey, 
          value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    },
    delete: async (key) => {
      const scopedKey = `${botClinicId}:${key}`;
      await supabaseAdmin
        .from('bot_sessions')
        .delete()
        .eq('key', scopedKey);
    },
  };
}
