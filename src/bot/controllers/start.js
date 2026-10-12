import { Keyboard } from 'grammy';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export function setupStartController(bot) {
  bot.command('setgroup', async (ctx) => {
    // Only allow this in a group
    if (ctx.chat.type === 'private') {
      return ctx.reply('This command can only be used in a group chat.');
    }
    
    try {
      await supabaseAdmin
        .from('bot_clinics')
        .update({ staff_chat_id: String(ctx.chat.id) })
        .eq('id', ctx.botClinicId);
        
      // Update the in-memory cache for this Vercel instance
      if (ctx.clinic) {
        ctx.clinic.staff_chat_id = String(ctx.chat.id);
      }
        
      await ctx.reply('✅ This group has been configured to receive new booking notifications!');
    } catch (e) {
      console.error(e);
      await ctx.reply('❌ Failed to configure group.');
    }
  });

  bot.command('bugun', async (ctx) => {
    // Only allow this in a group
    if (ctx.chat.type === 'private') {
      return ctx.reply('This command can only be used in a group chat.');
    }
    
    try {
      const now = new Date();
      // Target timezone is usually Asia/Tashkent. We can format it to get the local date string.
      const dateString = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const [year, month, day] = dateString.split('-');
      const startOfDayTashkent = new Date(`${year}-${month}-${day}T00:00:00+05:00`);
      const endOfDayTashkent = new Date(`${year}-${month}-${day}T23:59:59.999+05:00`);

      const { data: appointments, error } = await supabaseAdmin
        .from('appointments')
        .select(`
          id, start_time, status, notes,
          patients ( full_name, phone ),
          staff ( full_name )
        `)
        .eq('clinic_id', ctx.clinic.id)
        .gte('start_time', startOfDayTashkent.toISOString())
        .lte('start_time', endOfDayTashkent.toISOString())
        .not('status', 'in', '("cancelled")')
        .order('start_time', { ascending: true });

      if (error) throw error;

      if (!appointments || appointments.length === 0) {
        return ctx.reply(`📅 <b>Bugungi qabullar ro'yxati (${dateString})</b>\n\nBugun uchun qabullar yo'q.`, { parse_mode: 'HTML' });
      }

      let msg = `📅 <b>Bugungi qabullar ro'yxati (${dateString})</b>\n\n`;
      
      appointments.forEach((apt) => {
         const time = new Intl.DateTimeFormat('uz-UZ', { 
           timeZone: 'Asia/Tashkent', 
           hour: '2-digit', 
           minute: '2-digit' 
         }).format(new Date(apt.start_time));
         
         const pName = apt.patients?.full_name || 'Noma\'lum bemor';
         const pPhone = apt.patients?.phone || '';
         const docName = apt.staff?.full_name || 'Noma\'lum shifokor';
         
         msg += `<b>${time}</b> — 👤 ${pName}\n`;
         if (pPhone) msg += `📞 ${pPhone}\n`;
         msg += `👨‍⚕️ Shifokor: ${docName}\n\n`;
      });

      await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('Error fetching today appointments:', e);
      await ctx.reply('❌ Qabullarni yuklashda xatolik yuz berdi.');
    }
  });

  bot.command('start', async (ctx) => {
    // If the user has a bot_users record, verify they also completed registration (have a linked patient)
    if (ctx.dbUser) {
      const { data: links } = await supabaseAdmin
        .from('bot_patient_links')
        .select('patient_id')
        .eq('bot_user_id', ctx.dbUser.id)
        .limit(1);
        
      if (links && links.length > 0) {
        await showMainMenu(ctx);
        return;
      }
    }

    // Otherwise, start the onboarding flow by asking for language
    const kb = new Keyboard()
      .text('🇺🇿 O\'zbekcha')
      .text('🇷🇺 Русский')
      .resized()
      .oneTime();
      
    await ctx.reply("Tilni tanlang / Выберите язык:", { reply_markup: kb });
    ctx.session.step = 'awaiting_language';
  });

  bot.hears(['🇺🇿 O\'zbekcha', '🇷🇺 Русский'], async (ctx) => {
    if (ctx.session.step !== 'awaiting_language') return;

    const lang = ctx.message.text === '🇺🇿 O\'zbekcha' ? 'uz' : 'ru';
    ctx.session.language = lang;
    ctx.session.step = 'awaiting_contact';
    
    // Prompt for contact sharing
    const contactKb = new Keyboard()
      .requestContact(ctx.t('start.register_btn'))
      .resized()
      .oneTime();

    await ctx.reply(ctx.t('start.register_prompt'), { reply_markup: contactKb });
  });
}

export async function showMainMenu(ctx) {
  const kb = new Keyboard()
    .text(ctx.t('menu.book')).row()
    .text(ctx.t('menu.my_appointments')).text(ctx.t('menu.contact')).row()
    .text(ctx.t('menu.settings'))
    .resized();

  await ctx.reply(ctx.t('start.menu'), { reply_markup: kb });
  ctx.session.step = 'idle';
}
