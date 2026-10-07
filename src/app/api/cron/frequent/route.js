import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { decryptToken } from '../../../../lib/crypto';
import { Bot, InlineKeyboard } from 'grammy';
import { addMinutes, subMinutes } from 'date-fns';
import { t } from '../../../../bot/i18n';

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expectedToken && authHeader !== expectedToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: bots } = await supabaseAdmin
    .from('bot_clinics')
    .select('*')
    .eq('is_active', true);

  if (!bots || bots.length === 0) return NextResponse.json({ success: true });

  const now = new Date();
  let sent2h = 0;
  let sentFeedback = 0;

  for (const botClinic of bots) {
    let token;
    try {
      token = decryptToken(botClinic.bot_token_enc);
    } catch (e) {
      continue;
    }
    const bot = new Bot(token);
    const { formatInTimeZone } = await import('date-fns-tz');

    // 1. 2h Reminders
    if (botClinic.reminder_2h_enabled) {
      const startWindow = addMinutes(now, 105);
      const endWindow = addMinutes(now, 135);

      const { data: apps2h } = await supabaseAdmin
        .from('appointments')
        .select(`
          id, start_time, patient_id, dentist_id, status,
          staff:dentist_id (first_name, last_name),
          clinics:clinic_id (timezone, name)
        `)
        .eq('clinic_id', botClinic.clinic_id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('start_time', startWindow.toISOString())
        .lte('start_time', endWindow.toISOString());

      if (apps2h && apps2h.length > 0) {
        const appIds = apps2h.map(a => a.id);
        const { data: logs } = await supabaseAdmin
          .from('bot_message_log')
          .select('appointment_id')
          .in('appointment_id', appIds)
          .eq('kind', 'reminder_2h');

        const loggedIds = new Set(logs?.map(l => l.appointment_id) || []);
        const pending = apps2h.filter(a => !loggedIds.has(a.id));

        if (pending.length > 0) {
          const patientIds = pending.map(a => a.patient_id);
          const { data: links } = await supabaseAdmin
            .from('bot_patient_links')
            .select(`patient_id, bot_users!inner(chat_id, language, is_blocked)`)
            .in('patient_id', patientIds)
            .eq('clinic_id', botClinic.clinic_id);

          const linkMap = {};
          links?.forEach(l => {
            if (!l.bot_users.is_blocked) linkMap[l.patient_id] = l.bot_users;
          });

          for (const app of pending) {
            const user = linkMap[app.patient_id];
            if (!user) continue;

            const lang = user.language || 'uz';
            const clinicData = Array.isArray(app.clinics) ? app.clinics[0] : app.clinics;
            const tz = clinicData?.timezone || 'Asia/Tashkent';
            const time = formatInTimeZone(app.start_time, tz, 'HH:mm');
            
            const text = t(lang, 'reminders.hourly', { time });
            const kb = new InlineKeyboard()
              .text(t(lang, 'reminders.btn_confirm'), `rem_confirm_${app.id}`)
              .text(t(lang, 'reminders.btn_cancel'), `rem_cancel_${app.id}`);

            try {
              await bot.api.sendMessage(user.chat_id, text, { reply_markup: kb });
              await supabaseAdmin.from('bot_message_log').insert({
                appointment_id: app.id,
                kind: 'reminder_2h'
              });
              sent2h++;
            } catch (err) {
              if (err.error_code === 403) {
                await supabaseAdmin.from('bot_users').update({ is_blocked: true }).eq('chat_id', user.chat_id);
              }
            }
          }
        }
      }
    }

    // 2. Feedback Request
    if (botClinic.feedback_enabled) {
      const windowStart = subMinutes(now, 120);
      const windowEnd = subMinutes(now, 60);

      const { data: appsFb } = await supabaseAdmin
        .from('appointments')
        .select(`
          id, end_time, patient_id, status,
          clinics:clinic_id (name)
        `)
        .eq('clinic_id', botClinic.clinic_id)
        .eq('status', 'completed')
        .gte('end_time', windowStart.toISOString())
        .lte('end_time', windowEnd.toISOString());

      if (appsFb && appsFb.length > 0) {
        const appIds = appsFb.map(a => a.id);
        const { data: logs } = await supabaseAdmin
          .from('bot_message_log')
          .select('appointment_id')
          .in('appointment_id', appIds)
          .eq('kind', 'feedback_request');

        const loggedIds = new Set(logs?.map(l => l.appointment_id) || []);
        const pending = appsFb.filter(a => !loggedIds.has(a.id));

        if (pending.length > 0) {
          const patientIds = pending.map(a => a.patient_id);
          const { data: links } = await supabaseAdmin
            .from('bot_patient_links')
            .select(`patient_id, bot_users!inner(chat_id, language, is_blocked)`)
            .in('patient_id', patientIds)
            .eq('clinic_id', botClinic.clinic_id);

          const linkMap = {};
          links?.forEach(l => {
            if (!l.bot_users.is_blocked) linkMap[l.patient_id] = l.bot_users;
          });

          for (const app of pending) {
            const user = linkMap[app.patient_id];
            if (!user) continue;

            const lang = user.language || 'uz';
            const clinicData = Array.isArray(app.clinics) ? app.clinics[0] : app.clinics;
            const text = t(lang, 'reminders.feedback_req', { clinicName: clinicData?.name || '' });
            
            const kb = new InlineKeyboard()
              .text('1 ⭐', `fb_${app.id}_1`)
              .text('2 ⭐', `fb_${app.id}_2`)
              .text('3 ⭐', `fb_${app.id}_3`).row()
              .text('4 ⭐', `fb_${app.id}_4`)
              .text('5 ⭐', `fb_${app.id}_5`);

            try {
              await bot.api.sendMessage(user.chat_id, text, { reply_markup: kb });
              await supabaseAdmin.from('bot_message_log').insert({
                appointment_id: app.id,
                kind: 'feedback_request'
              });
              sentFeedback++;
            } catch (err) {
              if (err.error_code === 403) {
                await supabaseAdmin.from('bot_users').update({ is_blocked: true }).eq('chat_id', user.chat_id);
              }
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, sent2h, sentFeedback });
}
