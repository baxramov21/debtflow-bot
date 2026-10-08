import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function findAdmins() {
  console.log("Fetching staff with role 'admin'...");
  const { data: staffList, error } = await supabase
    .from('staff')
    .select('*')
    .eq('role', 'admin');

  if (error) {
    console.error("Error fetching staff:", error);
    return;
  }

  console.log("Admins found in staff table:", staffList.length);

  for (const staff of staffList) {
    console.log(`\nStaff Name: ${staff.full_name}`);
    console.log(`User ID: ${staff.user_id}`);
    
    // Fetch user from auth.users using admin api
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(staff.user_id);
    
    if (userError) {
      console.error(`  Could not find auth user for ${staff.user_id}:`, userError.message);
    } else {
      console.log(`  -> Associated Email: ${user.user.email}`);
    }
  }
}

findAdmins();
