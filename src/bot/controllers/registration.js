import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { normalizeLast9 } from '../../lib/phone';
import { showMainMenu } from './start';

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
      ctx.session.step = 'awaiting_age';
      await ctx.reply("Yoshingizni kiriting:\n\nВведите ваш возраст:");
      return;
    }

    if (ctx.session.step === 'awaiting_age') {
      const ageText = ctx.message.text.trim();
      const age = parseInt(ageText, 10);
      
      if (isNaN(age) || age < 1 || age > 120) {
        await ctx.reply("Iltimos, yoshingizni raqam bilan to'g'ri kiriting:\n\nПожалуйста, введите правильный возраст цифрами:");
        return;
      }
      
      const birthYear = new Date().getFullYear() - age;
      const birthDate = `${birthYear}-01-01`;

      try {
        const { data: newPatient, error: newPatientError } = await supabaseAdmin
          .from('patients')
          .insert({
            clinic_id: ctx.clinic.id,
            full_name: ctx.session.reg_name,
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
      return;
    }

    return next();
  });
}
