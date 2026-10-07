import { createClient } from '@supabase/supabase-js';

// Re-use standard env vars from Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_SUPABASE_URL : 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';

/**
 * Creates an admin client using the service role key.
 * This should ONLY be used in server environments (API routes, CRONs, scripts),
 * since it bypasses RLS policies entirely.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
