import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('trust proxy', () => {
  const saved = process.env.VERCEL;
  afterEach(() => {
    if (saved === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = saved;
  });

  it('trusts one proxy hop only on Vercel, where the platform sets X-Forwarded-For itself', () => {
    delete process.env.VERCEL;
    expect(createApp().get('trust proxy')).toBeFalsy();
    process.env.VERCEL = '1';
    expect(createApp().get('trust proxy')).toBe(1);
  });
});
