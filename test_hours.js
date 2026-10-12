const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  const { data: clinic } = await sb.from('clinics').select('working_hours').limit(1).single();
  console.log('Working hours:', JSON.stringify(clinic.working_hours, null, 2));
})();
