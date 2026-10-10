import { InlineKeyboard } from 'grammy';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { normalizeLast9 } from '../../lib/phone';
import { showMainMenu } from './start';

function getYearKeyboard(startYear) {
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < 12; i++) {
    const y = startYear + i;
    keyboard.text(String(y), `dob_year_${y}`);
    if ((i + 1) % 4 === 0) keyboard.row();
  }
  keyboard.text('⬅️', `dob_ypage_${startYear - 12}`);
  keyboard.text('➡️', `dob_ypage_${startYear + 12}`);
  return keyboard;
}

function getMonthKeyboard() {
  const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  const keyboard = new InlineKeyboard();
  months.forEach((m, i) => {
    keyboard.text(m, `dob_month_${i + 1}`);
    if ((i + 1) % 3 === 0) keyboard.row();
  });
  keyboard.text('⬅️ Ortga / Назад', 'dob_back_to_year');
  return keyboard;
}

function getDayKeyboard(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const keyboard = new InlineKeyboard();
  for (let i = 1; i <= daysInMonth; i++) {
    keyboard.text(String(i), `dob_day_${i}`);
    if (i % 7 === 0) keyboard.row();
  }
  if (daysInMonth % 7 !== 0) keyboard.row();
  keyboard.text('⬅️ Ortga / Назад', 'dob_back_to_month');
  return keyboard;
}

export function setupRegistrationController(bot) {
  bot.on('message:contact', async (ctx, next) => {
    if (ctx.session.step !== 'awaiting_contact') return next();

    const contact = ctx.message.contact;
    
    // Ensure they didn't send someone else's contact
    if (contact.user_id && contact.user_id !== ctx.from.id) {
      await ctx.reply(ctx.t('registration.error'));
      return;
    }

    const phoneStr = contact.phone_number;
    const last9 = normalizeLast9(phoneStr);
    
    if (last9.length !== 9) {
      await ctx.reply(ctx.t('registration.error'));
      return;
    }

    try {
      // 1. Check if patient exists in DentFlow
      const { data: matchedPatients, error: matchError } = await supabaseAdmin
        .rpc('bot_find_patients_by_phone', { 
          p_clinic: ctx.clinic.id, 
          p_last9: last9 
        });

      if (matchError) throw matchError;

      // 2. Create or update bot user
      const { data: botUser, error: userError } = await supabaseAdmin
        .from('bot_users')
        .upsert({
          bot_clinic_id: ctx.botClinicId,
          telegram_user_id: ctx.from.id,
          chat_id: ctx.chat.id,
          phone_normalized: last9,
          language: ctx.session.language,
          first_name: ctx.from.first_name,
          username: ctx.from.username,
        }, { onConflict: 'bot_clinic_id, telegram_user_id' })
        .select()
        .single();
        
      if (userError) throw userError;
      
      // Update context cache so subsequent calls this session have it
      ctx.dbUser = botUser;
      if (ctx.session) {
        ctx.session.dbUser = botUser;
      }

      // 3. Link if matched
      if (matchedPatients && matchedPatients.length > 0) {
        const primaryPatient = matchedPatients[0];
        
        await supabaseAdmin
          .from('bot_patient_links')
          .upsert({
            bot_user_id: botUser.id,
            patient_id: primaryPatient.id,
            clinic_id: ctx.clinic.id,
            created_via: 'match'
          }, { onConflict: 'bot_user_id, patient_id' });
          
        await ctx.reply(ctx.t('registration.success'), { reply_markup: { remove_keyboard: true } });
        await showMainMenu(ctx);
      } else {
        // User not found. Proceed to multi-step manual registration
        ctx.session.reg_phone = last9;
        ctx.session.step = 'awaiting_name';
        await ctx.reply("Iltimos, ism va familiyangizni kiriting:\n\nПожалуйста, введите ваше имя и фамилию:", { reply_markup: { remove_keyboard: true } });
      }
    } catch (err) {
      console.error('Registration match error:', err);
      await ctx.reply(ctx.t('registration.error'));
    }
  });

  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step === 'awaiting_name') {
      ctx.session.reg_name = ctx.message.text.trim();
      ctx.session.step = 'awaiting_dob';
      ctx.session.reg_dob = { year: null, month: null, day: null, ypage: 1990 };
      
      await ctx.reply("Tug'ilgan yilingizni tanlang:\n\nВыберите год рождения:", {
        reply_markup: getYearKeyboard(ctx.session.reg_dob.ypage)
      });
      return;
    }
    return next();
  });

  bot.callbackQuery(/^dob_ypage_(\d+)$/, async (ctx) => {
    const startYear = parseInt(ctx.match[1], 10);
    if (!ctx.session.reg_dob) ctx.session.reg_dob = {};
    ctx.session.reg_dob.ypage = startYear;
    await ctx.editMessageReplyMarkup({ reply_markup: getYearKeyboard(startYear) });
  });

  bot.callbackQuery(/^dob_year_(\d+)$/, async (ctx) => {
    const year = parseInt(ctx.match[1], 10);
    if (!ctx.session.reg_dob) ctx.session.reg_dob = {};
    ctx.session.reg_dob.year = year;
    await ctx.editMessageText(`Sizning tug'ilgan yilingiz: ${year}\nEndi oyni tanlang:\n\nВаш год рождения: ${year}\nТеперь выберите месяц:`, {
      reply_markup: getMonthKeyboard()
    });
  });

  bot.callbackQuery('dob_back_to_year', async (ctx) => {
    const startYear = ctx.session.reg_dob?.ypage || 1990;
    await ctx.editMessageText("Tug'ilgan yilingizni tanlang:\n\nВыберите год рождения:", {
      reply_markup: getYearKeyboard(startYear)
    });
  });

  bot.callbackQuery(/^dob_month_(\d+)$/, async (ctx) => {
    const month = parseInt(ctx.match[1], 10);
    if (!ctx.session.reg_dob) ctx.session.reg_dob = { year: 2000 };
    ctx.session.reg_dob.month = month;
    await ctx.editMessageText(`Sizning tug'ilgan yilingiz va oyingiz: ${ctx.session.reg_dob.year}-${String(month).padStart(2, '0')}\nEndi kunni tanlang:\n\nТеперь выберите день:`, {
      reply_markup: getDayKeyboard(ctx.session.reg_dob.year, month)
    });
  });

  bot.callbackQuery('dob_back_to_month', async (ctx) => {
    const year = ctx.session.reg_dob?.year || 2000;
    await ctx.editMessageText(`Sizning tug'ilgan yilingiz: ${year}\nEndi oyni tanlang:\n\nВаш год рождения: ${year}\nТеперь выберите месяц:`, {
      reply_markup: getMonthKeyboard()
    });
  });

  bot.callbackQuery(/^dob_day_(\d+)$/, async (ctx) => {
    const day = parseInt(ctx.match[1], 10);
    if (!ctx.session.reg_dob) ctx.session.reg_dob = { year: 2000, month: 1 };
    ctx.session.reg_dob.day = day;
    
    const { year, month } = ctx.session.reg_dob;
    const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    await ctx.editMessageText(`Sizning tug'ilgan sanangiz: ${birthDate}\n\nQayd etilmoqda... / Регистрация...`);
    
    try {
      const nameParts = ctx.session.reg_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      const { data: newPatient, error: newPatientError } = await supabaseAdmin
        .from('patients')
        .insert({
          clinic_id: ctx.clinic.id,
          first_name: firstName,
          last_name: lastName || null,
          phone: `+998${ctx.session.reg_phone}`,
          birth_date: birthDate
        })
        .select()
        .single();
        
      if (newPatientError) throw newPatientError;
      
      await supabaseAdmin
        .from('bot_patient_links')
        .insert({
          bot_user_id: ctx.dbUser.id,
          patient_id: newPatient.id,
          clinic_id: ctx.clinic.id,
          created_via: 'register'
        });

      ctx.session.step = 'idle';
      await ctx.reply(ctx.t('registration.success'));
      await showMainMenu(ctx);
    } catch (err) {
      console.error('Registration error (new patient):', err);
      await ctx.reply(ctx.t('registration.error'));
    }
  });
}
