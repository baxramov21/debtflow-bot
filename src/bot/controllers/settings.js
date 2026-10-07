import { InlineKeyboard } from 'grammy';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { showMainMenu } from './start';

export function setupSettingsController(bot) {
  bot.hears(['⚙️ Sozlamalar', '⚙️ Настройки'], async (ctx) => {
    if (!ctx.dbUser) return;
    
    const kb = new InlineKeyboard()
      .text('🇺🇿 O\'zbekcha', 'lang_uz').row()
      .text('🇷🇺 Русский', 'lang_ru');
      
    await ctx.reply(ctx.t('settings.choose_lang'), { reply_markup: kb });
  });

  bot.callbackQuery(/^lang_(.+)$/, async (ctx) => {
    const lang = ctx.match[1];
    
    if (['uz', 'ru'].includes(lang)) {
      ctx.session.language = lang;
      
      // Update DB
      if (ctx.dbUser) {
        await supabaseAdmin
          .from('bot_users')
          .update({ language: lang })
          .eq('id', ctx.dbUser.id);
      }
      
      await ctx.answerCallbackQuery();
      // Notice: we rely on ctx.t evaluating the current session language
      await ctx.editMessageText(ctx.t('settings.lang_changed'));
      await showMainMenu(ctx);
    } else {
      await ctx.answerCallbackQuery();
    }
  });
}
