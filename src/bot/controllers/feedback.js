import { supabaseAdmin } from '../../lib/supabaseAdmin';

export function setupFeedbackController(bot) {
  bot.callbackQuery(/^fb_(.+)_(.+)$/, async (ctx) => {
    const appId = ctx.match[1];
    const rating = parseInt(ctx.match[2], 10);
    
    // Ensure rating is between 1 and 5
    if (isNaN(rating) || rating < 1 || rating > 5) {
      await ctx.answerCallbackQuery();
      return;
    }

    // Get patient id 
    const { data: app } = await supabaseAdmin
      .from('appointments')
      .select('patient_id')
      .eq('id', appId)
      .single();

    if (!app) {
      await ctx.answerCallbackQuery();
      return;
    }

    // Check if already submitted
    const { data: existing } = await supabaseAdmin
      .from('bot_feedback')
      .select('id')
      .eq('appointment_id', appId)
      .single();

    if (existing) {
      await ctx.answerCallbackQuery();
      return;
    }

    // Insert feedback
    await supabaseAdmin.from('bot_feedback').insert({
      appointment_id: appId,
      patient_id: app.patient_id,
      rating
    });
    
    // Notify staff if rating <= 2
    // Phase 5 staff group alerts would go here

    await ctx.editMessageText(ctx.msg.text + `\n\nSizning bahoingiz/Ваша оценка: ${rating} ⭐\n` + ctx.t('reminders.feedback_thanks'));
    await ctx.answerCallbackQuery();
  });
}
