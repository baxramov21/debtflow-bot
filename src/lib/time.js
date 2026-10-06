import { formatInTimeZone, toDate } from 'date-fns-tz';
import { addDays, parseISO, startOfDay, addMinutes } from 'date-fns';

const TIMEZONE = 'Asia/Tashkent';

export function getTashkentNow() {
  return toDate(new Date(), { timeZone: TIMEZONE });
}

export function formatTashkentDate(date) {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

export function formatTashkentTime(date) {
  return formatInTimeZone(date, TIMEZONE, 'HH:mm');
}

export function parseTashkentDate(dateStr) {
  // Assuming dateStr is 'yyyy-MM-dd', parse it in Tashkent timezone
  return toDate(`${dateStr}T00:00:00`, { timeZone: TIMEZONE });
}

export function generateSlots(startHour, endHour, intervalMinutes) {
  const slots = [];
  let current = startOfDay(new Date());
  current = addMinutes(current, startHour * 60);
  
  const end = startOfDay(new Date());
  end = addMinutes(end, endHour * 60);
  
  while (current < end) {
    slots.push(formatTashkentTime(current));
    current = addMinutes(current, intervalMinutes);
  }
  return slots;
}
