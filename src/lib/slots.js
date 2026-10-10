import { addDays, addMinutes, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';

const DAYS_OF_WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function generateSlots({
  clinic,
  dentists, // Array of dentists [{ id, ... }]
  appointments, // Array of existing appointments [{ id, start_time, end_time, dentist_id }]
  now = new Date(),
  serviceDuration = null,
  onlyDate = null // 'yyyy-MM-dd' → only compute this day (faster)
}) {
  const tz = clinic.timezone || 'Asia/Tashkent';
  const horizonDays = clinic.booking_horizon_days || 14;
  const leadMin = clinic.min_lead_minutes || 60;
  const slotMin = serviceDuration || clinic.slot_minutes || 30;
  const workingHours = clinic.working_hours || {};

  const availableSlotsByDate = {};
  const cutoffTime = addMinutes(now, leadMin);

  // Pre-parse appointments once, grouped by dentist
  const apptsByDentist = new Map();
  for (const app of appointments) {
    if (!apptsByDentist.has(app.dentist_id)) apptsByDentist.set(app.dentist_id, []);
    apptsByDentist.get(app.dentist_id).push({
      start: new Date(app.start_time).getTime(),
      end: new Date(app.end_time).getTime()
    });
  }
  const isDentistFree = (dentistId, startMs, endMs) => {
    const list = apptsByDentist.get(dentistId);
    if (!list) return true;
    // Overlap condition: max(start1, start2) < min(end1, end2)
    return !list.some((a) => startMs < a.end && a.start < endMs);
  };

  for (let i = 0; i < horizonDays; i++) {
    const currentDate = addDays(now, i);
    // get day in tz
    const dateStr = formatInTimeZone(currentDate, tz, 'yyyy-MM-dd');
    if (onlyDate && dateStr !== onlyDate) continue;
    // We use a fixed 12:00:00 to avoid daylight saving issues when getting the day of the week
    const dummyDate = toDate(`${dateStr}T12:00:00`, { timeZone: tz });
    const dayOfWeek = DAYS_OF_WEEK[dummyDate.getDay()];

    const hours = workingHours[dayOfWeek];
    if (!hours || !hours.start || !hours.end) {
      continue; // closed this day
    }

    const dayStart = toDate(`${dateStr}T${hours.start}:00`, { timeZone: tz });
    const dayEnd = toDate(`${dateStr}T${hours.end}:00`, { timeZone: tz });

    // Lunch break (computed once per day)
    let breakStart = null;
    let breakEnd = null;
    if (workingHours.break_start_time && workingHours.break_end_time) {
      breakStart = toDate(`${dateStr}T${workingHours.break_start_time}:00`, { timeZone: tz });
      breakEnd = toDate(`${dateStr}T${workingHours.break_end_time}:00`, { timeZone: tz });
    }

    const slotsForDay = [];
    let currentSlot = dayStart;

    // Check if current slot + slot duration is less than or equal to dayEnd
    while (isBefore(currentSlot, dayEnd) && !isAfter(addMinutes(currentSlot, slotMin), dayEnd)) {
      const slotStart = currentSlot;
      const slotEnd = addMinutes(currentSlot, slotMin);

      // Check lunch break
      const isLunch = breakStart && breakEnd && slotStart < breakEnd && breakStart < slotEnd;

      // Check lead time and lunch break
      if (isAfter(slotStart, cutoffTime) && !isLunch) {
        const startMs = slotStart.getTime();
        const endMs = slotEnd.getTime();
        // Find which dentists are available
        const availableDentists = dentists.filter((dentist) => isDentistFree(dentist.id, startMs, endMs));

        if (availableDentists.length > 0) {
          slotsForDay.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            time: formatInTimeZone(slotStart, tz, 'HH:mm'),
            availableDentists: availableDentists.map((d) => d.id)
          });
        }
      }
      currentSlot = addMinutes(currentSlot, slotMin);
    }

    if (slotsForDay.length > 0) {
      availableSlotsByDate[dateStr] = slotsForDay;
    }
  }

  return availableSlotsByDate;
}

export function assignDentist(slot, appointments) {
  // Find the dentist among slot.availableDentists who has the least appointments on this slot's day
  if (!slot.availableDentists || slot.availableDentists.length === 0) return null;
  if (slot.availableDentists.length === 1) return slot.availableDentists[0];

  const slotStart = new Date(slot.start);
  const dayStart = startOfDay(slotStart);
  const dayEnd = endOfDay(slotStart);

  const counts = {};
  slot.availableDentists.forEach(d => counts[d] = 0);

  appointments.forEach(app => {
    if (counts[app.dentist_id] !== undefined) {
      const appStart = new Date(app.start_time);
      if (appStart >= dayStart && appStart <= dayEnd) {
        counts[app.dentist_id]++;
      }
    }
  });

  let minDentist = slot.availableDentists[0];
  let minCount = counts[minDentist];

  for (let i = 1; i < slot.availableDentists.length; i++) {
    const dId = slot.availableDentists[i];
    if (counts[dId] < minCount) {
      minCount = counts[dId];
      minDentist = dId;
    }
  }

  return minDentist;
}
