import { InlineKeyboard } from 'grammy';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { formatInTimeZone } from 'date-fns-tz';

export function setupAppointmentsController(bot) {
  bot.hears(['🕒 Mening qabullarim', '🕒 Мои записи'], async (ctx) => {
    if (!ctx.dbUser) return;
    
    // Fetch patient links
    const { data: links } = await supabaseAdmin
      .from('bot_patient_links')
      .select('patient_id')
      .eq('bot_user_id', ctx.dbUser.id);
      
    if (!links || links.length === 0) {
      await ctx.reply(ctx.t('appointments.empty'));
      return;
    }
    
    const patientIds = links.map(l => l.patient_id);
    const now = new Date();
    
    // Fetch upcoming appointments
    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, start_time, status, dentist_id,
        staff:dentist_id (full_name)
      `)
      .eq('clinic_id', ctx.clinic.id)
      .in('patient_id', patientIds)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true });
      
    if (!appointments || appointments.length === 0) {
      await ctx.reply(ctx.t('appointments.empty'));
      return;
    }
    
    // Fetch clinic rules
    const { data: botCfg } = await supabaseAdmin
      .from('bot_clinics')
      .select('allow_cancel, cancel_cutoff_hours')
      .eq('id', ctx.botClinicId)
      .single();
      
    const tz = ctx.clinic.timezone || 'Asia/Tashkent';
    
    await ctx.reply(ctx.t('appointments.list_header'));
    
    for (const app of appointments) {
      const date = formatInTimeZone(app.start_time, tz, 'yyyy-MM-dd');
      const time = formatInTimeZone(app.start_time, tz, 'HH:mm');
      const docName = app.staff ? app.staff.full_name : '';
      
      const text = ctx.t('appointments.item', {
        date, time, doctor: docName, status: app.status
      });
      
      const kb = new InlineKeyboard();
      
      // Check cancellation rules
      if (botCfg && botCfg.allow_cancel) {
        const startTime = new Date(app.start_time);
        const cutoffTime = new Date(startTime.getTime() - botCfg.cancel_cutoff_hours * 3600000);
        if (now < cutoffTime) {
          kb.text(ctx.t('appointments.btn_cancel'), `cancel_app_${app.id}`);
        }
      }
      
      // If there are no buttons, just send text
      if (kb.inline_keyboard.length > 0) {
        await ctx.reply(text, { reply_markup: kb });
      } else {
        await ctx.reply(text);
      }
    }
  });

  bot.callbackQuery(/^cancel_app_(.+)$/, async (ctx) => {
    const appId = ctx.match[1];
    
    // Check rules again to be safe
    const { data: app } = await supabaseAdmin
      .from('appointments')
      .select('start_time, status')
      .eq('id', appId)
      .single();
      
    if (!app || app.status === 'cancelled') {
      await ctx.answerCallbackQuery({ text: ctx.t('appointments.cancel_error'), show_alert: true });
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
        // Cancel it
        await supabaseAdmin
          .from('appointments')
          .update({ 
            status: 'cancelled', 
            notes: '[Telegram] Bemor bot orqali bekor qildi / Отменено через бот' 
          })
          .eq('id', appId);
          
        await ctx.editMessageText(ctx.msg.text + '\n\n' + ctx.t('appointments.cancel_success'));
        await ctx.answerCallbackQuery();
        return;
      }
    }
    
    await ctx.answerCallbackQuery({ text: ctx.t('appointments.cancel_error'), show_alert: true });
  });
}
