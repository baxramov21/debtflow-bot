import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { normalizeLast9 } from '../../lib/phone';
import { showMainMenu } from './start';

export function setupRegistrationController(bot) {
  bot.on('message:contact', async (ctx) => {
    if (ctx.session.step !== 'awaiting_contact') return;

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
        // Link to the first match (in a real app, maybe handle duplicates if they exist)
        const primaryPatient = matchedPatients[0];
        
        await supabaseAdmin
          .from('bot_patient_links')
          .upsert({
            bot_user_id: botUser.id,
            patient_id: primaryPatient.id,
            clinic_id: ctx.clinic.id,
            created_via: 'match'
          }, { onConflict: 'bot_user_id, patient_id' });
      } else {
        // Option A: If clinic allows self register, we could create a new patient in DentFlow here.
        // For now, we'll just link them if we do self register, but we don't have a patient ID yet.
        // We will create the patient in DentFlow database.
        
        // Let's check if we should self-register
        // (assume self_register is true for now)
        const { data: newPatient, error: newPatientError } = await supabaseAdmin
          .from('patients')
          .insert({
            clinic_id: ctx.clinic.id,
            full_name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Telegram User',
            phone: `+998${last9}`
          })
          .select()
          .single();
          
        if (newPatientError) throw newPatientError;
        
        await supabaseAdmin
          .from('bot_patient_links')
          .insert({
            bot_user_id: botUser.id,
            patient_id: newPatient.id,
            clinic_id: ctx.clinic.id,
            created_via: 'register'
          });
      }

      await ctx.reply(ctx.t('registration.success'));
      await showMainMenu(ctx);
      
    } catch (err) {
      console.error('Registration error:', err);
      await ctx.reply(ctx.t('registration.error'));
    }
  });
}
