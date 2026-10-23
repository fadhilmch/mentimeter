import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertNotRevokedKeyless } from '../src/lib/firebase.js';
import { config } from '../src/config.js';

// Without a service account the server asks Firebase's public lookup whether the token is still good.
// Same rule as the Admin SDK: reject when auth_time is before the account's validSince, when the account
// is gone or disabled, and when the lookup itself fails.
describe('keyless revocation check', () => {
  const savedKey = config.firebase.webApiKey;
  const reply = (ok, body) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })));

  beforeEach(() => {
    config.firebase.webApiKey = 'public-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    config.firebase.webApiKey = savedKey;
  });

  it('accepts a token issued after the account became valid', async () => {
    reply(true, { users: [{ localId: 'u1', validSince: '900' }] });
    await expect(assertNotRevokedKeyless('tok', 1000)).resolves.toBeUndefined();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('accounts:lookup?key=public-key');
    expect(JSON.parse(init.body)).toEqual({ idToken: 'tok' });
  });

  it('accepts a token issued at exactly the boundary', async () => {
    reply(true, { users: [{ validSince: '1000' }] });
    await expect(assertNotRevokedKeyless('tok', 1000)).resolves.toBeUndefined();
  });

  it('rejects a token issued before the account became valid (signed out everywhere or password reset)', async () => {
    reply(true, { users: [{ validSince: '1001' }] });
    await expect(assertNotRevokedKeyless('tok', 1000)).rejects.toMatchObject({ code: 'auth/id-token-revoked' });
  });

  it('rejects a disabled account', async () => {
    reply(true, { users: [{ validSince: '1', disabled: true }] });
    await expect(assertNotRevokedKeyless('tok', 1000)).rejects.toMatchObject({ code: 'auth/id-token-revoked' });
  });

  it('rejects a deleted account and a failed lookup', async () => {
    reply(true, {});
    await expect(assertNotRevokedKeyless('tok', 1000)).rejects.toThrow();
    reply(false, { error: { message: 'USER_NOT_FOUND' } });
    await expect(assertNotRevokedKeyless('tok', 1000)).rejects.toThrow();
  });

  it('rejects a token without auth_time, and fails closed when the lookup throws or no key is set', async () => {
    reply(true, { users: [{ validSince: '1' }] });
    await expect(assertNotRevokedKeyless('tok', undefined)).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    await expect(assertNotRevokedKeyless('tok', 1000)).rejects.toThrow();
    config.firebase.webApiKey = '';
    await expect(assertNotRevokedKeyless('tok', 1000)).rejects.toThrow(/FIREBASE_API_KEY/);
  });
});
