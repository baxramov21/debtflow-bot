import { describe, it, expect } from 'vitest';
import { normalizeLast9, formatUz } from '../src/lib/phone';

describe('Phone Utilities', () => {
  describe('normalizeLast9', () => {
    it('extracts last 9 digits correctly from various formats', () => {
      expect(normalizeLast9('+998901234567')).toBe('901234567');
      expect(normalizeLast9('998 (90) 123-45-67')).toBe('901234567');
      expect(normalizeLast9('901234567')).toBe('901234567');
      expect(normalizeLast9('abc 90 123 45 67 xyz')).toBe('901234567');
    });

    it('returns empty string on empty input', () => {
      expect(normalizeLast9(null)).toBe('');
      expect(normalizeLast9(undefined)).toBe('');
      expect(normalizeLast9('')).toBe('');
    });
  });

  describe('formatUz', () => {
    it('formats a 9-digit number correctly', () => {
      expect(formatUz('901234567')).toBe('+998-90-123-45-67');
      expect(formatUz('+998 (90) 123-45-67')).toBe('+998-90-123-45-67');
    });
  });
});
