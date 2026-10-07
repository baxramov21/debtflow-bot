-- Phase 6 (Messaging): Messaging logs and Feedback

CREATE TABLE IF NOT EXISTS bot_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('booking_confirm', 'reminder_24h', 'reminder_2h', 'feedback_request')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(appointment_id, kind)
);

CREATE TABLE IF NOT EXISTS bot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bot_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_feedback ENABLE ROW LEVEL SECURITY;
