import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken } from '../src/lib/crypto';
import crypto from 'crypto';

describe('Crypto Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set a valid 64-char hex key for testing (32 bytes)
    process.env.BOT_TOKEN_ENC_KEY = crypto.randomBytes(32).toString('hex');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts a token correctly', () => {
    const token = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
    
    const encrypted = encryptToken(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:cipher
    
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it('throws if key is not set', () => {
    delete process.env.BOT_TOKEN_ENC_KEY;
    
    const token = 'test-token';
    expect(() => encryptToken(token)).toThrow('BOT_TOKEN_ENC_KEY is not set');
  });

  it('throws on invalid encrypted format', () => {
    expect(() => decryptToken('invalid-format')).toThrow('Invalid encrypted token format');
  });
});
