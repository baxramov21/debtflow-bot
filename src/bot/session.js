import { supabaseAdmin } from '../lib/supabaseAdmin';

/**
 * Custom Storage Adapter for grammY using Supabase
 *
 * grammY writes the session back after every update, even if nothing changed.
 * We remember a JSON snapshot of what was read and skip the upsert when the
 * value is identical, saving a DB round-trip on many clicks.
 */
export function supabaseStorage(botClinicId) {
  const snapshots = new Map();

  return {
    read: async (key) => {
      // Scope keys to the clinic so multiple bots don't collide on same user ID
      const scopedKey = `${botClinicId}:${key}`;
      const { data, error } = await supabaseAdmin
        .from('bot_sessions')
        .select('value')
        .eq('key', scopedKey)
        .maybeSingle();

      if (error || !data) {
        snapshots.delete(scopedKey);
        return undefined;
      }
      snapshots.set(scopedKey, JSON.stringify(data.value));
      return data.value;
    },
    write: async (key, value) => {
      const scopedKey = `${botClinicId}:${key}`;
      const serialized = JSON.stringify(value);
      const previous = snapshots.get(scopedKey);
      snapshots.delete(scopedKey);
      if (previous === serialized) return; // unchanged → skip write

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
      snapshots.delete(scopedKey);
      await supabaseAdmin
        .from('bot_sessions')
        .delete()
        .eq('key', scopedKey);
    },
  };
}
