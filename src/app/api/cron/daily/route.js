import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { decryptToken } from '../../../../lib/crypto';
import { Bot, InlineKeyboard } from 'grammy';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { t } from '../../../../bot/i18n';

export async function GET(req) {
  // Check auth
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expectedToken && authHeader !== expectedToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Find tomorrow in UTC
  const now = new Date();
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));

  // Find all active bots
  const { data: bots } = await supabaseAdmin
    .from('bot_clinics')
    .select('*')
    .eq('is_active', true);

  if (!bots || bots.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  let sentCount = 0;

  for (const botClinic of bots) {
    // Find appointments for tomorrow for this clinic
    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, start_time, patient_id, dentist_id, status,
        staff:dentist_id (first_name, last_name),
        clinics:clinic_id (timezone, name)
      `)
      .eq('clinic_id', botClinic.clinic_id)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', tomorrowStart.toISOString())
      .lte('start_time', tomorrowEnd.toISOString());

    if (!appointments || appointments.length === 0) continue;

    const appIds = appointments.map(a => a.id);
    const { data: logs } = await supabaseAdmin
      .from('bot_message_log')
      .select('appointment_id')
      .in('appointment_id', appIds)
      .eq('kind', 'reminder_24h');

    const loggedIds = new Set(logs?.map(l => l.appointment_id) || []);
    const pendingApps = appointments.filter(a => !loggedIds.has(a.id));

    if (pendingApps.length === 0) continue;

    const patientIds = pendingApps.map(a => a.patient_id);
    const { data: links } = await supabaseAdmin
      .from('bot_patient_links')
      .select(`
        patient_id, 
        bot_users!inner(chat_id, language, is_blocked)
      `)
      .in('patient_id', patientIds)
      .eq('clinic_id', botClinic.clinic_id);

    const linkMap = {};
    links?.forEach(l => {
      if (!l.bot_users.is_blocked) {
        linkMap[l.patient_id] = l.bot_users;
      }
    });

    if (Object.keys(linkMap).length === 0) continue;

    let token;
    try {
      token = decryptToken(botClinic.bot_token_enc);
    } catch (e) {
      console.error(`Decryption failed for bot ${botClinic.id}`);
      continue;
    }

    const bot = new Bot(token);
    // dynamically import formatInTimeZone to prevent top-level await issues if any
    const { formatInTimeZone } = await import('date-fns-tz');

    for (const app of pendingApps) {
      const user = linkMap[app.patient_id];
      if (!user) continue;

      const lang = user.language || 'uz';
      const docName = app.staff ? `${app.staff.first_name} ${app.staff.last_name || ''}` : '';
      const clinicData = Array.isArray(app.clinics) ? app.clinics[0] : app.clinics;
      const tz = clinicData?.timezone || 'Asia/Tashkent';
      const clinicName = clinicData?.name || '';
      
      const time = formatInTimeZone(app.start_time, tz, 'HH:mm');
      const date = formatInTimeZone(app.start_time, tz, 'yyyy-MM-dd');

      const text = t(lang, 'reminders.daily', {
        clinicName, date, time, doctor: docName
      });

      const kb = new InlineKeyboard()
        .text(t(lang, 'reminders.btn_confirm'), `rem_confirm_${app.id}`)
        .text(t(lang, 'reminders.btn_cancel'), `rem_cancel_${app.id}`);

      try {
        await bot.api.sendMessage(user.chat_id, text, { reply_markup: kb });
        
        // Log to bot_message_log
        await supabaseAdmin.from('bot_message_log').insert({
          appointment_id: app.id,
          kind: 'reminder_24h'
        });

        // VERY IMPORTANT: Insert into notifications to prevent SMS fallback
        await supabaseAdmin.from('notifications').insert({
          clinic_id: botClinic.clinic_id,
          patient_id: app.patient_id,
          appointment_id: app.id,
          type: 'telegram',
          template: 'bot_reminder_24h',
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        sentCount++;
      } catch (err) {
        console.error(`Failed to send 24h reminder to ${user.chat_id}:`, err);
        // If 403 Forbidden, user blocked the bot
        if (err.error_code === 403) {
          await supabaseAdmin.from('bot_users').update({ is_blocked: true }).eq('chat_id', user.chat_id);
        }
      }
    }
  }

  return NextResponse.json({ success: true, sent: sentCount });
}
