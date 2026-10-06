/**
 * Normalizes a phone number to get its last 9 digits.
 * Useful for matching +998-XX-XXX-XX-XX against user contacts.
 */
export function normalizeLast9(phoneStr) {
  if (!phoneStr) return '';
  const digitsOnly = phoneStr.replace(/\D/g, '');
  return digitsOnly.slice(-9);
}

/**
 * Formats a 9-digit string or any string containing phone digits
 * into the standard format +998-XX-XXX-XX-XX
 */
export function formatUz(phoneStr) {
  const last9 = normalizeLast9(phoneStr);
  if (last9.length !== 9) return phoneStr; // Can't format properly if not 9 digits
  
  return `+998-${last9.slice(0, 2)}-${last9.slice(2, 5)}-${last9.slice(5, 7)}-${last9.slice(7, 9)}`;
}
