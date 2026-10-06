import { Bot, session } from 'grammy';
import { supabaseStorage } from './session';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { t } from './i18n';
import { setupStartController } from './controllers/start';
import { setupRegistrationController } from './controllers/registration';

/**
 * Creates and configures a grammY Bot instance for a specific clinic
 */
export async function createBot(token, botClinicId, clinicData) {
  const bot = new Bot(token);

  // Error handling
  bot.catch((err) => {
    console.error(`Error for bot ${botClinicId}:`, err);
  });

  // Session middleware
  bot.use(session({
    initial: () => ({ step: 'idle', language: 'uz' }),
    storage: supabaseStorage(botClinicId),
  }));

  // Context enhancer middleware
  bot.use(async (ctx, next) => {
    ctx.clinic = clinicData;
    ctx.botClinicId = botClinicId;
    
    // Quick translation helper bound to session language
    const lang = ctx.session?.language || 'uz';
    ctx.t = (path, params) => t(lang, path, params);

    // Fetch user from DB if exists
    if (ctx.from) {
      const { data: user } = await supabaseAdmin
        .from('bot_users')
        .select('*')
        .eq('bot_clinic_id', botClinicId)
        .eq('telegram_user_id', ctx.from.id)
        .single();
      
      ctx.dbUser = user;
      if (user && user.language) {
        ctx.session.language = user.language;
      }
    }
    
    await next();
  });

  // We will attach controllers in Phase 2
  setupStartController(bot);
  setupRegistrationController(bot);

  return bot;
}
