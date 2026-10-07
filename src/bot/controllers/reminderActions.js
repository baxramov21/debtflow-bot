import { supabaseAdmin } from '../../lib/supabaseAdmin';

export function setupReminderActionsController(bot) {
  bot.callbackQuery(/^rem_confirm_(.+)$/, async (ctx) => {
    const appId = ctx.match[1];
    
    const { data: app } = await supabaseAdmin
      .from('appointments')
      .select('status')
      .eq('id', appId)
      .single();
      
    if (!app || app.status !== 'scheduled') {
      // If already confirmed or cancelled, do nothing
      await ctx.answerCallbackQuery();
      return;
    }
    
    // Update to confirmed
    await supabaseAdmin
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appId);
      
    await ctx.editMessageText(ctx.msg.text + '\n\n' + ctx.t('reminders.confirmed'));
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^rem_cancel_(.+)$/, async (ctx) => {
    const appId = ctx.match[1];
    
    const { data: app } = await supabaseAdmin
      .from('appointments')
      .select('start_time, status')
      .eq('id', appId)
      .single();
      
    if (!app || app.status === 'cancelled') {
      await ctx.answerCallbackQuery();
      return;
    }

    const { data: botCfg } = await supabaseAdmin
      .from('bot_clinics')
      .select('allow_cancel, cancel_cutoff_hours')
      .eq('id', ctx.botClinicId)
      .single();
      
    if (botCfg && botCfg.allow_cancel) {
      const now = new Date();
      const startTime = new Date(app.start_time);
      const cutoffTime = new Date(startTime.getTime() - botCfg.cancel_cutoff_hours * 3600000);
      
      if (now < cutoffTime) {
        await supabaseAdmin
          .from('appointments')
          .update({ 
            status: 'cancelled', 
            notes: '[Telegram] Bemor bot orqali eslatmadan keyin bekor qildi / Отменено через бот' 
          })
          .eq('id', appId);
          
        await ctx.editMessageText(ctx.msg.text + '\n\n' + ctx.t('reminders.cancelled'));
        await ctx.answerCallbackQuery();
        return;
      }
    }
    
    await ctx.answerCallbackQuery({ text: ctx.t('appointments.cancel_error'), show_alert: true });
  });
}
