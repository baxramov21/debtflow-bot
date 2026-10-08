import { createClient } from '../../../lib/supabaseServer'
import { redirect } from 'next/navigation'
import ClinicDashboardClient from './ClinicDashboardClient'

export default async function ClinicPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: staffList } = await supabase
    .from('staff')
    .select('clinic_id, role, clinics(name)')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)

  const staff = staffList?.[0]

  if (!staff) {
    return (
      <div className="container mt-10">
        <div className="glass-panel text-center">
          <h2>Access Denied</h2>
          <p className="text-gray mt-4">You must be a clinic admin to view this page.</p>
        </div>
      </div>
    )
  }

  const { data: botClinic } = await supabase
    .from('bot_clinics')
    .select('*')
    .eq('clinic_id', staff.clinic_id)
    .single()

  let stats = null;
  if (botClinic) {
    const { count: linkedPatients } = await supabase
      .from('bot_patient_links')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', staff.clinic_id);
      
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
    const { count: botBookings7d } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', staff.clinic_id)
      .gte('created_at', sevenDaysAgo.toISOString())
      .like('notes', '[Telegram]%');

    const { count: botCancellations } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', staff.clinic_id)
      .eq('status', 'cancelled')
      .like('notes', '[Telegram]%');

    const { data: feedbacks } = await supabase
      .from('bot_feedback')
      .select('rating, appointments!inner(clinic_id)')
      .eq('appointments.clinic_id', staff.clinic_id);
      
    let avgRating = 0;
    if (feedbacks && feedbacks.length > 0) {
      const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
      avgRating = (sum / feedbacks.length).toFixed(1);
    }
    
    const { data: lowFeedbackData } = await supabase
      .from('bot_feedback')
      .select('rating, comment, created_at, patients(first_name, last_name), appointments!inner(clinic_id)')
      .eq('appointments.clinic_id', staff.clinic_id)
      .lte('rating', 2)
      .order('created_at', { ascending: false })
      .limit(5);
      
    const recentLowRatings = lowFeedbackData || [];

    stats = {
      linkedPatients: linkedPatients || 0,
      botBookings7d: botBookings7d || 0,
      botCancellations: botCancellations || 0,
      avgRating,
      recentLowRatings
    };
  }

  const clinicName = Array.isArray(staff.clinics) ? staff.clinics[0]?.name : staff.clinics?.name

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="flex justify-between items-center mb-8">
        <h2>{clinicName} Bot Admin</h2>
      </div>
      
      <ClinicDashboardClient initialBotClinic={botClinic} stats={stats} />
    </div>
  )
}
