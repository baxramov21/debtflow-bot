import { supabaseAdmin } from '../../lib/supabaseAdmin';

const statusEmojis = {
  'caries': '🕳',
  'pulpitis': '🔥',
  'periodontitis': '💢',
  'missing': '❌',
  'crown': '👑',
  'implant': '🔩',
  'filled': '✨',
  'healthy': '🦷'
};

export function setupChartController(bot) {
  bot.hears(['🦷 Tishlar xaritasi', '🦷 Зубная карта'], async (ctx) => {
    if (!ctx.dbUser) return;
    
    // Check if toggle is enabled
    const { data: botCfg } = await supabaseAdmin
      .from('bot_clinics')
      .select('show_dental_chart')
      .eq('id', ctx.botClinicId)
      .single();
      
    if (!botCfg?.show_dental_chart) {
      await ctx.reply(ctx.t('features.disabled'));
      return;
    }
    
    // Fetch patient links
    const { data: links } = await supabaseAdmin
      .from('bot_patient_links')
      .select('patient_id, patients!inner(first_name, last_name)')
      .eq('bot_user_id', ctx.dbUser.id);
      
    if (!links || links.length === 0) {
      await ctx.reply(ctx.t('chart.empty'));
      return;
    }

    let report = [];
    
    for (const link of links) {
      const pId = link.patient_id;
      const name = `${link.patients.first_name} ${link.patients.last_name || ''}`.trim();
      
      const { data: chart } = await supabaseAdmin
        .from('tooth_status')
        .select('tooth_number, status')
        .eq('patient_id', pId)
        .eq('clinic_id', ctx.botClinicId)
        .neq('status', 'healthy')
        .order('tooth_number', { ascending: true });
        
      if (!chart || chart.length === 0) {
        report.push(ctx.t('chart.healthy', { name }));
      } else {
        const lines = chart.map(t => {
          const emoji = statusEmojis[t.status] || '🦷';
          // Fallback just in case translation is missing for a new status
          const statusText = ctx.t(`chart.status.${t.status}`) || t.status;
          return `${emoji} ${t.tooth_number}: ${statusText}`;
        });
        report.push(`👤 ${name}:\n` + lines.join('\n'));
      }
    }
    
    await ctx.reply(report.join('\n\n'));
  });
}
