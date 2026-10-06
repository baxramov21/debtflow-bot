-- Phase 1: Foundation Tables for the Telegram Bot

CREATE TABLE IF NOT EXISTS bot_clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,
  bot_token_enc TEXT NOT NULL,
  bot_username TEXT,
  bot_info JSONB,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  staff_chat_id TEXT,
  bind_code TEXT,
  allow_self_register BOOLEAN DEFAULT true,
  allow_cancel BOOLEAN DEFAULT true,
  cancel_cutoff_hours INT DEFAULT 2,
  reminder_2h_enabled BOOLEAN DEFAULT true,
  feedback_enabled BOOLEAN DEFAULT true,
  show_balance BOOLEAN DEFAULT false,
  show_dental_chart BOOLEAN DEFAULT false,
  slot_minutes INT DEFAULT 30,
  booking_horizon_days INT DEFAULT 14,
  min_lead_minutes INT DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_clinic_id UUID NOT NULL REFERENCES bot_clinics(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  phone_normalized TEXT,
  language TEXT DEFAULT 'uz',
  first_name TEXT,
  username TEXT,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bot_clinic_id, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS bot_patient_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id UUID NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_via TEXT CHECK (created_via IN ('match', 'register', 'family')) DEFAULT 'match',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bot_user_id, patient_id)
);

CREATE TABLE IF NOT EXISTS bot_sessions (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS with no policies to restrict access only to service role
ALTER TABLE bot_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_patient_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function to find patients by phone
CREATE OR REPLACE FUNCTION bot_find_patients_by_phone(p_clinic UUID, p_last9 TEXT)
RETURNS SETOF patients
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM patients 
  WHERE clinic_id = p_clinic 
  AND right(regexp_replace(phone, '\D', '', 'g'), 9) = p_last9;
$$;
