const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  const { data: clinic } = await sb.from('clinics').select('id').limit(1).single();

  const { data, error } = await sb
    .from('appointments')
    .select(`
      id, start_time, status,
      patients ( full_name, phone ),
      staff ( full_name )
    `)
    .eq('clinic_id', clinic.id)
    .limit(1);
  console.log('Select error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
})();
