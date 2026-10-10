import { Bot, session } from 'grammy';
import { supabaseStorage } from './session';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { t } from './i18n';
import { setupStartController } from './controllers/start';
import { setupRegistrationController } from './controllers/registration';
import { setupBookingController } from './controllers/booking';
import { setupAppointmentsController } from './controllers/appointments';
import { setupSettingsController } from './controllers/settings';
import { setupReminderActionsController } from './controllers/reminderActions';
import { setupFeedbackController } from './controllers/feedback';
import { setupBalanceController } from './controllers/balance';
import { setupChartController } from './controllers/chart';

/**
 * Creates and configures a grammY Bot instance for a specific clinic
 * @param {object} [botInfo] Cached Telegram getMe() result. When provided,
 *   grammY skips the getMe API call during init (saves a round-trip on cold start).
 */
export async function createBot(token, botClinicId, clinicData, botInfo) {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  // Error handling
  bot.catch((err) => {
    console.error(`Error for bot ${botClinicId}:`, err);
  });

  // Timing + non-blocking callback answers.
  // answerCallbackQuery is fired immediately but not awaited by handlers;
  // we await all pending answers at the end so the serverless function
  // doesn't freeze before they complete.
  bot.use(async (ctx, next) => {
    const started = Date.now();
    const pending = [];
    if (ctx.callbackQuery) {
      const original = ctx.answerCallbackQuery.bind(ctx);
      ctx.answerCallbackQuery = (...args) => {
        pending.push(original(...args).catch(() => {}));
        return Promise.resolve(true);
      };
    }
    try {
      await next();
    } finally {
      await Promise.all(pending);
      const kind = ctx.callbackQuery?.data || ctx.message?.text || Object.keys(ctx.update)[1];
      console.log(`[bot ${botClinicId}] ${String(kind).slice(0, 40)} handled in ${Date.now() - started}ms`);
    }
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
      if (ctx.session.dbUser) {
        ctx.dbUser = ctx.session.dbUser;
      } else {
        const { data: user } = await supabaseAdmin
          .from('bot_users')
          .select('*')
          .eq('bot_clinic_id', botClinicId)
          .eq('telegram_user_id', ctx.from.id)
          .single();
        
        ctx.dbUser = user;
        if (user) {
          ctx.session.dbUser = user;
        }
      }
      
      if (ctx.dbUser && ctx.dbUser.language) {
        ctx.session.language = ctx.dbUser.language;
      }
    }
    
    await next();
  });

  // Controllers
  setupStartController(bot);
  setupRegistrationController(bot);
  setupBookingController(bot);
  setupAppointmentsController(bot);
  setupSettingsController(bot);
  setupReminderActionsController(bot);
  setupFeedbackController(bot);
  setupBalanceController(bot);
  setupChartController(bot);

  return bot;
}
