'use server'

import { createClient } from '../../lib/supabaseServer'
import { redirect } from 'next/navigation'
import { tgGetMe, tgSetWebhook, tgDeleteWebhook, tgSetMyCommands } from '../../lib/telegramAdmin'
import { encryptToken, decryptToken } from '../../lib/crypto'
import crypto from 'crypto'

export async function login(formData) {
  const supabase = await createClient()
  
  const data = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  redirect('/admin/clinic')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

export async function connectBot(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Check if admin is a staff member
  const { data: staff } = await supabase
    .from('staff')
    .select('clinic_id, role')
    .eq('user_id', user.id)
    .single()

  if (!staff || staff.role !== 'admin') {
    return { error: 'Must be clinic admin' }
  }

  const token = formData.get('token')
  if (!token) return { error: 'Token required' }

  // Check if token equals DentFlow bot token
  const { data: clinic } = await supabase
    .from('clinics')
    .select('telegram_bot_token')
    .eq('id', staff.clinic_id)
    .single()

  if (clinic && clinic.telegram_bot_token === token) {
    return { error: 'Please create a NEW bot for patients. Do not use the existing staff bot.' }
  }

  // Verify token with Telegram
  const me = await tgGetMe(token)
  if (!me.ok) {
    return { error: 'Invalid Telegram Bot Token' }
  }

  const botUsername = me.result.username
  const webhookSecret = crypto.randomBytes(32).toString('hex')
  const botTokenEnc = encryptToken(token)

  // Upsert into bot_clinics
  const { data: botClinic, error: upsertErr } = await supabase
    .from('bot_clinics')
    .upsert({
      clinic_id: staff.clinic_id,
      bot_token_enc: botTokenEnc,
      bot_username: botUsername,
      webhook_secret: webhookSecret,
      is_active: true
    }, { onConflict: 'clinic_id' })
    .select()
    .single()

  if (upsertErr) {
    return { error: 'Database error' }
  }

  // Set Webhook
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.vercel.app'
  const webhookUrl = `${appUrl}/api/bot/${botClinic.id}`
  const webhookRes = await tgSetWebhook(token, webhookUrl, webhookSecret)

  if (!webhookRes.ok) {
    return { error: 'Failed to set webhook on Telegram' }
  }

  // Set commands
  await tgSetMyCommands(token)

  return { success: true, botUsername }
}

export async function disconnectBot(botId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: botClinic } = await supabase
    .from('bot_clinics')
    .select('bot_token_enc')
    .eq('id', botId)
    .single()

  if (botClinic) {
    try {
      const token = decryptToken(botClinic.bot_token_enc)
      await tgDeleteWebhook(token)
    } catch(e) {}
  }

  await supabase.from('bot_clinics').delete().eq('id', botId)
  
  return { success: true }
}

export async function saveSettings(botId, formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const updates = {
    allow_self_register: formData.get('allow_self_register') === 'on',
    allow_cancel: formData.get('allow_cancel') === 'on',
    cancel_cutoff_hours: parseInt(formData.get('cancel_cutoff_hours') || '2', 10),
    reminder_2h_enabled: formData.get('reminder_2h_enabled') === 'on',
    feedback_enabled: formData.get('feedback_enabled') === 'on',
    show_balance: formData.get('show_balance') === 'on',
    show_dental_chart: formData.get('show_dental_chart') === 'on'
  }

  const { error } = await supabase
    .from('bot_clinics')
    .update(updates)
    .eq('id', botId)

  if (error) return { error: error.message }
  return { success: true }
}
