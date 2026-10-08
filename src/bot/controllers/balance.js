import { supabaseAdmin } from '../../lib/supabaseAdmin';

export function setupBalanceController(bot) {
  bot.hears(['💳 Mening hisobim', '💳 Мой баланс'], async (ctx) => {
    if (!ctx.dbUser) return;
    
    // Check if toggle is enabled
    const { data: botCfg } = await supabaseAdmin
      .from('bot_clinics')
      .select('show_balance')
      .eq('id', ctx.botClinicId)
      .single();
      
    if (!botCfg?.show_balance) {
      await ctx.reply(ctx.t('features.disabled'));
      return;
    }
    
    // Fetch patient links
    const { data: links } = await supabaseAdmin
      .from('bot_patient_links')
      .select('patient_id, patients!inner(first_name, last_name)')
      .eq('bot_user_id', ctx.dbUser.id);
      
    if (!links || links.length === 0) {
      await ctx.reply(ctx.t('balance.empty'));
      return;
    }

    let report = [];
    
    for (const link of links) {
      const pId = link.patient_id;
      const name = `${link.patients.first_name} ${link.patients.last_name || ''}`.trim();
      
      // Get all completed treatment items for this patient
      const { data: treatments } = await supabaseAdmin
        .from('treatment_items')
        .select('price_override, status, appointments!inner(patient_id, clinic_id)')
        .eq('status', 'completed')
        .eq('appointments.patient_id', pId)
        .eq('appointments.clinic_id', ctx.clinic.id);
        
      let totalCost = 0;
      if (treatments) {
        for (const t of treatments) {
          totalCost += Number(t.price_override || 0);
        }
      }
      
      // Get all payments for this patient
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('amount')
        .eq('patient_id', pId)
        .eq('clinic_id', ctx.clinic.id);
        
      let totalPaid = 0;
      if (payments) {
        for (const p of payments) {
          totalPaid += Number(p.amount || 0);
        }
      }
      
      const balance = totalCost - totalPaid;
      report.push(ctx.t('balance.item', { name, balance: balance.toLocaleString() }));
    }
    
    await ctx.reply(report.join('\n\n'));
  });
}
