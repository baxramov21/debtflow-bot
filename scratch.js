import { supabaseAdmin } from './src/lib/supabaseAdmin.js';

async function run() {
  const { data, error } = await supabaseAdmin.from('clinics').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data[0], null, 2));
  }
}
run();
