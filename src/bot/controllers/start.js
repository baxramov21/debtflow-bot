import { Keyboard } from 'grammy';

export function setupStartController(bot) {
  bot.command('start', async (ctx) => {
    // If the user is fully registered, show main menu
    if (ctx.dbUser) {
      await showMainMenu(ctx);
      return;
    }

    // Otherwise, start the onboarding flow by asking for language
    const kb = new Keyboard()
      .text('🇺🇿 O\'zbekcha')
      .text('🇷🇺 Русский')
      .resized()
      .oneTime();
      
    await ctx.reply("Tilni tanlang / Выберите язык:", { reply_markup: kb });
    ctx.session.step = 'awaiting_language';
  });

  bot.hears(['🇺🇿 O\'zbekcha', '🇷🇺 Русский'], async (ctx) => {
    if (ctx.session.step !== 'awaiting_language') return;

    const lang = ctx.message.text === '🇺🇿 O\'zbekcha' ? 'uz' : 'ru';
    ctx.session.language = lang;
    ctx.session.step = 'awaiting_contact';
    
    // Prompt for contact sharing
    const contactKb = new Keyboard()
      .requestContact(ctx.t('start.register_btn'))
      .resized()
      .oneTime();

    await ctx.reply(ctx.t('start.register_prompt'), { reply_markup: contactKb });
  });
}

export async function showMainMenu(ctx) {
  const kb = new Keyboard()
    .text(ctx.t('menu.book')).row()
    .text(ctx.t('menu.my_appointments')).text(ctx.t('menu.contact')).row()
    .text(ctx.t('menu.settings'))
    .resized();

  await ctx.reply(ctx.t('start.menu'), { reply_markup: kb });
  ctx.session.step = 'idle';
}
