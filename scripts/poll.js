import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createBot } from '../src/bot/createBot.js';
import { decryptToken } from '../src/lib/crypto.js';

// Load .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function startPolling() {
  const botId = process.argv[2];
  
  if (!botId) {
    console.error('Usage: node scripts/poll.js <bot_clinic_id>');
    console.log('\nAvailable bots:');
    
    const { data: bots } = await supabaseAdmin.from('bot_clinics').select('id, bot_username');
    if (bots && bots.length > 0) {
      bots.forEach(b => console.log(`- ${b.id} (@${b.bot_username || 'unknown'})`));
    } else {
      console.log('(No bots found in database)');
    }
    process.exit(1);
  }

  const { data: botClinic, error } = await supabaseAdmin
    .from('bot_clinics')
    .select(`*, clinics:clinic_id (id, name)`)
    .eq('id', botId)
    .single();

  if (error || !botClinic) {
    console.error(`Bot ${botId} not found`);
    process.exit(1);
  }

  const token = decryptToken(botClinic.bot_token_enc);
  const bot = await createBot(token, botId, botClinic.clinics);
  
  console.log(`Starting polling for @${botClinic.bot_username}...`);
  
  // Use drop_pending_updates to ignore old messages
  bot.start({ drop_pending_updates: true });
}

startPolling();
