import { webhookCallback } from 'grammy';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { decryptToken } from '../../../../lib/crypto';
import { createBot } from '../../../../bot/createBot';

// Cache bots in memory to avoid recreating them on every request
const botsCache = new Map();

export async function POST(req, { params }) {
  const { botId } = await params;
  
  try {
    let botInfo = botsCache.get(botId);
    
    if (!botInfo) {
      // 1. Fetch clinic bot details
      const { data: botClinic, error } = await supabaseAdmin
        .from('bot_clinics')
        .select(`
          *,
          clinics:clinic_id (id, name, subdomain)
        `)
        .eq('id', botId)
        .single();
        
      if (error || !botClinic) {
        return new Response('Bot not found', { status: 404 });
      }
      
      if (!botClinic.is_active) {
        return new Response('Bot inactive', { status: 403 });
      }

      // 2. Decrypt token
      let token;
      try {
        token = decryptToken(botClinic.bot_token_enc);
      } catch (err) {
        console.error('Failed to decrypt token for bot', botId);
        return new Response('Internal config error', { status: 500 });
      }
      
      // 3. Create bot instance
      const bot = await createBot(token, botId, botClinic.clinics);
      
      botInfo = { bot, secret: botClinic.webhook_secret };
      botsCache.set(botId, botInfo);
    }
    
    // 4. Verify webhook secret if configured
    if (botInfo.secret) {
      const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
      if (secretHeader !== botInfo.secret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    
    // 5. Pass to grammY
    return webhookCallback(botInfo.bot, 'std/http')(req);
    
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}
