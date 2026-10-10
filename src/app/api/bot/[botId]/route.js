import { webhookCallback, Api } from 'grammy';
import { after } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { decryptToken } from '../../../../lib/crypto';
import { createBot } from '../../../../bot/createBot';

// Cache bots in memory to avoid recreating them on every request
const botsCache = new Map();

export async function POST(req, { params }) {
  const { botId } = await params;
  
  try {
    let botInfoEntry = botsCache.get(botId);
    
    if (!botInfoEntry) {
      // 1. Fetch clinic bot details
      const { data: botClinic, error } = await supabaseAdmin
        .from('bot_clinics')
        .select(`
          *,
          clinics:clinic_id (id, name, timezone, working_hours, currency)
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
      const unifiedClinicData = {
        ...botClinic.clinics,
        booking_horizon_days: botClinic.booking_horizon_days,
        min_lead_minutes: botClinic.min_lead_minutes,
        slot_minutes: botClinic.slot_minutes,
        staff_chat_id: botClinic.staff_chat_id
      };

      // Use cached getMe() result to avoid a Telegram round-trip on cold start.
      // If missing (older rows), fetch once and persist it for next time.
      let botInfo = botClinic.bot_info;
      if (!botInfo) {
        try {
          botInfo = await new Api(token).getMe();
          const info = botInfo;
          after(async () => {
            const { error: e } = await supabaseAdmin
              .from('bot_clinics')
              .update({ bot_info: info })
              .eq('id', botId);
            if (e) console.warn('Could not cache bot_info:', e.message);
          });
        } catch (err) {
          console.error('getMe failed for bot', botId, err);
          botInfo = undefined;
        }
      }

      const bot = await createBot(token, botId, unifiedClinicData, botInfo);
      
      botInfoEntry = {
        bot,
        secret: botClinic.webhook_secret,
        handler: webhookCallback(bot, 'std/http'),
      };
      botsCache.set(botId, botInfoEntry);
    }
    
    // 4. Verify webhook secret if configured
    if (botInfoEntry.secret) {
      const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
      if (secretHeader !== botInfoEntry.secret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    
    // 5. Pass to grammY
    return await botInfoEntry.handler(req);
    
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}
