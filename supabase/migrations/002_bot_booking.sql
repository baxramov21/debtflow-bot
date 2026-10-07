-- Phase 3: Booking Flow Functions

CREATE OR REPLACE FUNCTION bot_book_appointment(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_dentist_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_id BIGINT;
  v_overlap_count INT;
  v_appointment_id UUID;
BEGIN
  -- Create a consistent lock ID for the dentist (using standard hashtext)
  v_lock_id := hashtext(p_dentist_id::TEXT);
  
  -- Acquire an advisory transaction lock for this dentist
  PERFORM pg_advisory_xact_lock(v_lock_id);

  -- Re-check for overlapping appointments for this dentist
  -- (Overlap means: existing_start < new_end AND existing_end > new_start)
  SELECT COUNT(*)
  INTO v_overlap_count
  FROM appointments
  WHERE clinic_id = p_clinic_id
    AND dentist_id = p_dentist_id
    AND status NOT IN ('cancelled', 'no_show')
    AND start_time < p_end_time
    AND end_time > p_start_time;

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END IF;

  -- Insert the appointment
  INSERT INTO appointments (
    clinic_id, patient_id, dentist_id, start_time, end_time, status, notes
  ) VALUES (
    p_clinic_id, p_patient_id, p_dentist_id, p_start_time, p_end_time, 'scheduled', p_notes
  ) RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;
