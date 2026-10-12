const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  const { data: clinic } = await sb.from('clinics').select('id').limit(1).single();

  const { data, error } = await sb
    .from('patients')
    .insert({
      clinic_id: clinic.id,
      full_name: 'Test Debug',
      phone: '+998000000000',
      birth_date: '2007-04-06',
      date_of_birth: '2007-04-06'
    })
    .select()
    .single();
  console.log('Insert error:', error);
  if (data) {
    console.log('Inserted OK, cleaning up', data.id);
    await sb.from('patients').delete().eq('id', data.id);
  }
})();
