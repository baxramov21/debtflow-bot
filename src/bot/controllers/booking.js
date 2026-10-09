import { InlineKeyboard } from 'grammy';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { generateSlots, assignDentist } from '../../lib/slots';
import { showMainMenu } from './start';

export function setupBookingController(bot) {
  // 1. Entry point
  bot.hears(['📅 Qabulga yozilish', '📅 Записаться на прием'], async (ctx) => {
    if (!ctx.dbUser) return;
    
    // Fetch dentists
    const { data: dentists, error } = await supabaseAdmin
      .from('staff')
      .select('id, full_name, user_id')
      .eq('clinic_id', ctx.clinic.id)
      .eq('is_active', true);

    if (error || !dentists || dentists.length === 0) {
      await ctx.reply(ctx.t('booking.error'));
      return;
    }

    const kb = new InlineKeyboard();
    kb.text(ctx.t('booking.any_doctor'), `book_doc_any`).row();
    
    dentists.forEach(d => {
      kb.text(`👨‍⚕️ ${d.full_name}`, `book_doc_${d.id}`).row();
    });

    await ctx.reply(ctx.t('booking.select_doctor'), { reply_markup: kb });
  });

  // 2. Select Doctor
  bot.callbackQuery(/^book_doc_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const docId = ctx.match[1];
    ctx.session.booking = { docId };
    await showDatesMenu(ctx);
  });

  // 3. Select Date
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

  // 4. Select Time
  bot.callbackQuery(/^book_time_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const timeStr = ctx.match[1]; // HH:mm
    ctx.session.booking.timeStr = timeStr;
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

async function fetchBookingData(ctx) {
  const { data: dentists } = await supabaseAdmin
    .from('staff')
    .select('id, full_name')
    .eq('clinic_id', ctx.clinic.id)
    .eq('is_active', true);

  const now = new Date();
  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select('id, start_time, end_time, dentist_id')
    .eq('clinic_id', ctx.clinic.id)
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
    .gte('start_time', now.toISOString());

  return {
    dentists: dentists || [],
    appointments: appointments || [],
    slotsMap: generateSlots({
      clinic: ctx.clinic,
      dentists: dentists || [],
      appointments: appointments || [],
      now
    })
  };
}

async function showDatesMenu(ctx, isEdit = false) {
  const { slotsMap } = await fetchBookingData(ctx);
  const docId = ctx.session.booking.docId;
  ctx.session.booking.slotsMap = slotsMap; // Save temporarily in session

  const dates = Object.keys(slotsMap).sort();
  const kb = new InlineKeyboard();
  
  let hasSlots = false;

  for (const date of dates) {
    const daySlots = slotsMap[date].filter(s => docId === 'any' || s.availableDentists.includes(docId));
    if (daySlots.length > 0) {
      hasSlots = true;
      kb.text(date, `book_date_${date}`);
      // Simple grid of 2 columns
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
  const docId = ctx.session.booking.docId;
  const slotsMap = ctx.session.booking.slotsMap;
  const page = ctx.session.booking.timePage || 0;
  const PAGE_SIZE = 12;

  const daySlots = (slotsMap[dateStr] || []).filter(s => docId === 'any' || s.availableDentists.includes(docId));
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

async function showConfirmMenu(ctx) {
  const { docId, dateStr, timeStr, slotsMap } = ctx.session.booking;
  
  const slot = slotsMap[dateStr].find(s => s.time === timeStr);
  if (!slot) {
    await ctx.editMessageText(ctx.t('booking.error'));
    return;
  }
  
  ctx.session.booking.slotStart = slot.start;
  ctx.session.booking.slotEnd = slot.end;
  
  if (docId === 'any') {
    const { appointments } = await fetchBookingData(ctx);
    ctx.session.booking.assignedDocId = assignDentist(slot, appointments);
  } else {
    ctx.session.booking.assignedDocId = docId;
  }

  const { data: dentist } = await supabaseAdmin
    .from('staff')
    .select('full_name')
    .eq('id', ctx.session.booking.assignedDocId)
    .single();

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

  const { data: links } = await supabaseAdmin
    .from('bot_patient_links')
    .select('patient_id')
    .eq('bot_user_id', ctx.dbUser.id)
    .limit(1);

  if (!links || links.length === 0) {
    await ctx.editMessageText(ctx.t('booking.error'));
    return;
  }

  const patientId = links[0].patient_id;

  try {
    const { data, error } = await supabaseAdmin.rpc('bot_book_appointment', {
      p_clinic_id: ctx.clinic.id,
      p_patient_id: patientId,
      p_dentist_id: b.assignedDocId,
      p_start_time: b.slotStart,
      p_end_time: b.slotEnd,
      p_notes: '[Telegram] Bemor telegram bot orqali yozildi'
    });

    if (error) throw error;

    await supabaseAdmin.from('bot_message_log').insert({
      appointment_id: data,
      kind: 'booking_confirm'
    });

    await ctx.editMessageText(ctx.t('booking.success'));
  } catch (err) {
    console.error('Booking error:', err);
    await ctx.editMessageText(ctx.t('booking.error'));
  }

  ctx.session.booking = null;
}
