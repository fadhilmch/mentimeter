import { describe, it, expect } from 'vitest';
import { generateAccessCode, generateUniqueAccessCode } from '../src/lib/accessCode.js';

describe('generateAccessCode', () => {
  it('produces codes of the requested length from the requested alphabet', () => {
    const code = generateAccessCode({ length: 8, alphabet: 'AB' });
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[AB]+$/);
  });

  it('is tunable and deterministic under an injected random source', () => {
    const code = generateAccessCode({ length: 4, alphabet: '0123456789', random: () => 0.9999 });
    expect(code).toBe('9999');
  });

  it('rejects unusable configuration', () => {
    expect(() => generateAccessCode({ length: 0 })).toThrow(RangeError);
    expect(() => generateAccessCode({ alphabet: 'x' })).toThrow(RangeError);
  });
});

describe('generateUniqueAccessCode', () => {
  it('retries until the exists-check passes', async () => {
    const taken = new Set(['000000', '111111']);
    let calls = 0;
    const code = await generateUniqueAccessCode(async (candidate) => {
      calls += 1;
      return taken.has(candidate);
    }, { random: () => (calls < 2 ? 0 : 0.5) });
    expect(calls).toBe(3);
    expect(taken.has(code)).toBe(false);
  });

  it('fails loudly when the space is exhausted', async () => {
    await expect(generateUniqueAccessCode(async () => true, { maxAttempts: 3 })).rejects.toThrow(/unique access code/);
  });
});
