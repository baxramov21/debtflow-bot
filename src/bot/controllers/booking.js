import { InlineKeyboard } from 'grammy';
import { after } from 'next/server';
import { addDays } from 'date-fns';
import { toDate } from 'date-fns-tz';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { generateSlots, assignDentist } from '../../lib/slots';
import { cached } from '../../lib/memoCache';
import { showMainMenu } from './start';

// Short TTL: admin edits (working hours, lunch, staff, services) show up within a minute
const CACHE_TTL_MS = 60 * 1000;

function getServices(clinicId) {
  return cached(`services:${clinicId}`, CACHE_TTL_MS, async () => {
    const { data, error } = await supabaseAdmin
      .from('services')
      .select('id, name_uz, name_ru, name, price, duration_minutes')
      .eq('clinic_id', clinicId)
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  });
}

function getDentists(clinicId) {
  return cached(`staff:${clinicId}`, CACHE_TTL_MS, async () => {
    const { data, error } = await supabaseAdmin
      .from('staff')
      .select('id, full_name')
      .eq('clinic_id', clinicId)
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  });
}

function getClinicSettings(clinicId) {
  return cached(`clinic:${clinicId}`, CACHE_TTL_MS, async () => {
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('working_hours, min_lead_minutes, slot_minutes, booking_horizon_days, timezone')
      .eq('id', clinicId)
      .single();
    if (error) throw error;
    return data;
  });
}

export function setupBookingController(bot) {
  // 1. Entry point
  bot.hears(['📅 Qabulga yozilish', '📅 Записаться на прием'], async (ctx) => {
    if (!ctx.dbUser) return;
    
    // Fetch services (cached)
    let services = [];
    let error = null;
    try {
      services = await getServices(ctx.clinic.id);
    } catch (e) {
      error = e;
    }

    if (error || !services || services.length === 0) {
      // Fallback: Skip services
      ctx.session.booking = { serviceId: 'none', serviceDuration: null, serviceName: '' };
      await showDatesMenu(ctx);
      return;
    }

    ctx.session.booking = { step: 'service' };
    
    const kb = new InlineKeyboard();
    services.forEach(s => {
      const name = ctx.session.language === 'ru' ? (s.name_ru || s.name) : (s.name_uz || s.name);
      kb.text(`🦷 ${name} (${s.price} UZS)`, `book_srv_${s.id}`).row();
    });

    kb.row().text(ctx.t('booking.btn_cancel'), 'book_cancel');
    await ctx.reply(ctx.t('booking.select_service'), { reply_markup: kb });
  });

  // 1.5 Select Service
  bot.callbackQuery(/^book_srv_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const serviceId = ctx.match[1];
    
    const services = await getServices(ctx.clinic.id).catch(() => []);
    let service = services.find(s => String(s.id) === serviceId);
    if (!service) {
      const { data } = await supabaseAdmin
        .from('services')
        .select('name_uz, name_ru, name, duration_minutes')
        .eq('id', serviceId)
        .single();
      service = data;
    }
      
    if (!service) {
      await ctx.editMessageText(ctx.t('booking.error'));
      return;
    }
    
    const name = ctx.session.language === 'ru' ? (service.name_ru || service.name) : (service.name_uz || service.name);
    
    ctx.session.booking = { 
      serviceId, 
      serviceDuration: service.duration_minutes,
      serviceName: name
    };
    await showDatesMenu(ctx, true);
  });

  // 2. Select Date
  bot.callbackQuery(/^book_date_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const dateStr = ctx.match[1];
    ctx.session.booking.dateStr = dateStr;
    ctx.session.booking.timePage = 0; // Reset page on new date
    await showTimesMenu(ctx);
  });

  // Time pagination
  bot.callbackQuery(/^book_time_page_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    ctx.session.booking.timePage = parseInt(ctx.match[1], 10);
    await showTimesMenu(ctx);
  });
  
  // Ignore button
  bot.callbackQuery('ignore', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
  });

  // 3. Select Time
  bot.callbackQuery(/^book_time_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const timeStr = ctx.match[1]; // HH:mm
    ctx.session.booking.timeStr = timeStr;
    await showDoctorsMenu(ctx);
  });

  // 4. Select Doctor
  bot.callbackQuery(/^book_doc_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const docId = ctx.match[1];
    ctx.session.booking.docId = docId;
    await showConfirmMenu(ctx);
  });

  // 5. Confirm
  bot.callbackQuery('book_confirm', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await handleBookingConfirm(ctx);
  });

  // Cancel / Back
  bot.callbackQuery('book_cancel', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    ctx.session.booking = null;
    await ctx.deleteMessage().catch(() => {});
    await showMainMenu(ctx);
  });
  
  bot.callbackQuery('book_back_to_dates', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await showDatesMenu(ctx, true);
  });
}

/**
 * Loads everything needed to compute slots.
 * Clinic settings & staff come from a 60s cache; appointments are always fresh
 * but limited to the needed window (a single day if `dateStr` is given).
 */
async function fetchBookingData(ctx, dateStr = null) {
  const now = new Date();

  // Window is computed from ctx.clinic (loaded at bot init) so the
  // appointments query can run in parallel with the cached lookups.
  const tz = ctx.clinic.timezone || 'Asia/Tashkent';
  let rangeStart = now;
  let rangeEnd;
  if (dateStr) {
    const dayStart = toDate(`${dateStr}T00:00:00`, { timeZone: tz });
    rangeEnd = addDays(dayStart, 1);
    if (dayStart > now) rangeStart = dayStart;
  } else {
    // generous upper bound in case booking_horizon_days was increased recently
    rangeEnd = addDays(now, Math.max(ctx.clinic.booking_horizon_days || 14, 60) + 1);
  }

  const [dentists, latestClinic, appointmentsRes] = await Promise.all([
    getDentists(ctx.clinic.id).catch(() => []),
    getClinicSettings(ctx.clinic.id).catch(() => null),
    // Includes appointments that started before rangeStart but are still running
    supabaseAdmin
      .from('appointments')
      .select('id, start_time, end_time, dentist_id')
      .eq('clinic_id', ctx.clinic.id)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .gt('end_time', rangeStart.toISOString())
      .lt('start_time', rangeEnd.toISOString()),
  ]);

  const updatedClinic = { ...ctx.clinic, ...(latestClinic || {}) };
  const appointments = appointmentsRes.data;

  return {
    dentists: dentists || [],
    appointments: appointments || [],
    slotsMap: generateSlots({
      clinic: updatedClinic,
      dentists: dentists || [],
      appointments: appointments || [],
      now,
      serviceDuration: ctx.session.booking?.serviceDuration,
      onlyDate: dateStr
    })
  };
}

async function showDatesMenu(ctx, isEdit = false) {
  const { slotsMap } = await fetchBookingData(ctx);

  const dates = Object.keys(slotsMap).sort();
  const kb = new InlineKeyboard();
  
  let hasSlots = false;

  for (const date of dates) {
    // any slot on this date means the date is available
    if (slotsMap[date] && slotsMap[date].length > 0) {
      hasSlots = true;
      kb.text(date, `book_date_${date}`);
      if (kb.inline_keyboard[kb.inline_keyboard.length - 1].length >= 2) {
        kb.row();
      }
    }
  }

  if (!hasSlots) {
    if (isEdit) {
      await ctx.editMessageText(ctx.t('booking.no_slots'));
    } else {
      await ctx.editMessageText(ctx.t('booking.no_slots')).catch(async () => {
        await ctx.reply(ctx.t('booking.no_slots'));
      });
    }
    return;
  }

  kb.row().text(ctx.t('booking.btn_cancel'), 'book_cancel');

  const text = ctx.t('booking.select_date');
  if (isEdit) {
    await ctx.editMessageText(text, { reply_markup: kb });
  } else {
    await ctx.editMessageText(text, { reply_markup: kb }).catch(async () => {
      await ctx.reply(text, { reply_markup: kb });
    });
  }
}

async function showTimesMenu(ctx) {
  const dateStr = ctx.session.booking.dateStr;
  const { slotsMap } = await fetchBookingData(ctx, dateStr);
  const page = ctx.session.booking.timePage || 0;
  const PAGE_SIZE = 12;

  const daySlots = slotsMap[dateStr] || [];
  const totalPages = Math.ceil(daySlots.length / PAGE_SIZE);
  const paginatedSlots = daySlots.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const kb = new InlineKeyboard();
  paginatedSlots.forEach(s => {
    kb.text(s.time, `book_time_${s.time}`);
    if (kb.inline_keyboard[kb.inline_keyboard.length - 1].length >= 3) {
      kb.row();
    }
  });

  if (kb.inline_keyboard.length > 0 && kb.inline_keyboard[kb.inline_keyboard.length - 1].length > 0) {
    kb.row();
  }

  if (totalPages > 1) {
    if (page > 0) {
      kb.text('⬅️', `book_time_page_${page - 1}`);
    }
    kb.text(`${page + 1} / ${totalPages}`, 'ignore');
    if (page < totalPages - 1) {
      kb.text('➡️', `book_time_page_${page + 1}`);
    }
    kb.row();
  }

  kb.row()
    .text(ctx.t('booking.back'), 'book_back_to_dates')
    .text(ctx.t('booking.btn_cancel'), 'book_cancel');

  const text = ctx.t('booking.select_time', { date: dateStr });
  await ctx.editMessageText(text, { reply_markup: kb });
}

async function showDoctorsMenu(ctx) {
  const { dateStr, timeStr } = ctx.session.booking;
  const { slotsMap, dentists: allDentists } = await fetchBookingData(ctx, dateStr);
  const slot = slotsMap[dateStr] ? slotsMap[dateStr].find(s => s.time === timeStr) : null;
  
  if (!slot || !slot.availableDentists || slot.availableDentists.length === 0) {
    await ctx.editMessageText(ctx.t('booking.error'));
    return;
  }
  
  const availableSet = new Set(slot.availableDentists);
  const dentists = allDentists.filter(d => availableSet.has(d.id));
    
  const kb = new InlineKeyboard();
  kb.text(ctx.t('booking.any_doctor'), `book_doc_any`).row();
  
  (dentists || []).forEach(d => {
    kb.text(`👨‍⚕️ ${d.full_name}`, `book_doc_${d.id}`).row();
  });
  
  kb.row()
    .text(ctx.t('booking.back'), 'book_back_to_dates') // Optional: add book_back_to_times later
    .text(ctx.t('booking.btn_cancel'), 'book_cancel');
    
  await ctx.editMessageText(ctx.t('booking.select_doctor'), { reply_markup: kb });
}

async function showConfirmMenu(ctx) {
  const { docId, dateStr, timeStr } = ctx.session.booking;
  
  const { slotsMap, appointments, dentists } = await fetchBookingData(ctx, dateStr);
  const slot = slotsMap[dateStr] ? slotsMap[dateStr].find(s => s.time === timeStr) : null;
  if (!slot) {
    await ctx.editMessageText(ctx.t('booking.error'));
    return;
  }
  
  ctx.session.booking.slotStart = slot.start;
  ctx.session.booking.slotEnd = slot.end;
  
  if (docId === 'any') {
    ctx.session.booking.assignedDocId = assignDentist(slot, appointments);
  } else {
    ctx.session.booking.assignedDocId = docId;
  }

  const dentist = dentists.find(d => String(d.id) === String(ctx.session.booking.assignedDocId));
  const docName = dentist ? dentist.full_name : '';

  const kb = new InlineKeyboard()
    .text(ctx.t('booking.btn_confirm'), 'book_confirm').row()
    .text(ctx.t('booking.btn_cancel'), 'book_cancel');

  const text = ctx.t('booking.confirm', {
    date: dateStr,
    time: timeStr,
    doctor: docName
  });

  await ctx.editMessageText(text, { reply_markup: kb });
}

async function handleBookingConfirm(ctx) {
  const b = ctx.session.booking;
  if (!b || !b.assignedDocId) {
    await ctx.editMessageText(ctx.t('booking.error'));
    return;
  }

  // patientId is cached in the session after the first lookup
  let patientId = ctx.session.patientId;
  if (!patientId) {
    const { data: links } = await supabaseAdmin
      .from('bot_patient_links')
      .select('patient_id')
      .eq('bot_user_id', ctx.dbUser.id)
      .limit(1);

    if (!links || links.length === 0) {
      await ctx.editMessageText(ctx.t('booking.error'));
      return;
    }
    patientId = links[0].patient_id;
    ctx.session.patientId = patientId;
  }

  try {
    let notes = '[Telegram] Bemor telegram bot orqali yozildi';
    if (b.serviceName) {
      notes += `\nXizmat: ${b.serviceName}`;
    }

    const serviceIdToPass = (!b.serviceId || b.serviceId === 'none') ? null : b.serviceId;

    let data, error;
    
    // Try the new RPC with service_id first
    const res = await supabaseAdmin.rpc('bot_book_appointment', {
      p_clinic_id: ctx.clinic.id,
      p_patient_id: patientId,
      p_dentist_id: b.assignedDocId,
      p_start_time: b.slotStart,
      p_end_time: b.slotEnd,
      p_notes: notes,
      p_service_id: serviceIdToPass
    });

    data = res.data;
    error = res.error;

    // If it fails because the migration hasn't been run, fall back to the old signature
    if (error && error.message && error.message.includes('Could not find function')) {
      console.warn('New RPC not found, falling back to old signature. Did you forget to run the SQL migration?');
      const fallbackRes = await supabaseAdmin.rpc('bot_book_appointment', {
        p_clinic_id: ctx.clinic.id,
        p_patient_id: patientId,
        p_dentist_id: b.assignedDocId,
        p_start_time: b.slotStart,
        p_end_time: b.slotEnd,
        p_notes: notes
      });
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) throw error;

    // Send notification to staff group if configured
    if (ctx.clinic.staff_chat_id) {
      try {
        const patientName = [ctx.dbUser.first_name, ctx.dbUser.last_name].filter(Boolean).join(' ') || ctx.dbUser.phone_normalized || 'Patient';
        const serviceText = b.serviceName ? `for ${b.serviceName}` : 'for a consultation';
        
        let docName = '';
        try {
          const dentists = await getDentists(ctx.clinic.id);
          const dentist = dentists.find(d => String(d.id) === String(b.assignedDocId));
          if (dentist) docName = dentist.full_name;
        } catch (e) {
          console.warn('Could not fetch dentist name for staff notification', e);
        }

        const docText = docName ? `Dr. ${docName}` : 'the doctor';
        const msg = `New booking: ${patientName} to ${docText} ${serviceText} on ${b.dateStr} at ${b.timeStr}.`;
        
        after(() => ctx.api.sendMessage(ctx.clinic.staff_chat_id, msg).catch(() => {}));
      } catch (e) {
        console.error('Failed to send staff notification', e);
      }
    }

    // Log after the response is sent (falls back to inline when not in a
    // Next.js request, e.g. local polling script)
    const logInsert = () => supabaseAdmin.from('bot_message_log').insert({
      appointment_id: data,
      kind: 'booking_confirm'
    });
    try {
      after(logInsert);
    } catch {
      await logInsert();
    }

    await ctx.editMessageText(ctx.t('booking.success'));
  } catch (err) {
    console.error('Booking error:', err);
    await ctx.editMessageText(ctx.t('booking.error'));
  }

  ctx.session.booking = null;
}
