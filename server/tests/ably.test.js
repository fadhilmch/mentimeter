import { afterEach, describe, expect, it } from 'vitest';
import { createSubscriberToken, getAblyRest, publishState } from '../src/ably.js';

const FAKE_KEY = 'app.keyid:secretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsec=';

afterEach(() => {
  delete process.env.ABLY_API_KEY;
});

describe('Ably env gating', () => {
  it('is disabled without ABLY_API_KEY: no client, publish is a no-op', async () => {
    delete process.env.ABLY_API_KEY;
    expect(getAblyRest()).toBeNull();
    expect(await publishState('123456', { any: 'thing' })).toBe(false);
  });

  it('issues subscribe-only token requests scoped to the presentation channel', async () => {
    process.env.ABLY_API_KEY = FAKE_KEY;
    expect(getAblyRest()).not.toBeNull();
    const tokenRequest = await createSubscriberToken('123456', 'test-client');
    const capability = JSON.parse(tokenRequest.capability);
    expect(Object.keys(capability)).toEqual(['presentation:123456']);
    expect([...capability['presentation:123456']].sort()).toEqual(['presence', 'subscribe']);
    expect(tokenRequest.clientId).toBe('test-client');
    expect(tokenRequest.ttl).toBe(3600000);
    expect(tokenRequest.mac).toBeTruthy();
    // Audience can never publish or manage: no '*' or 'publish' rights leak in.
    expect(tokenRequest.capability).not.toContain('publish');
  });

  it('throws for token creation when unconfigured', async () => {
    delete process.env.ABLY_API_KEY;
    await expect(createSubscriberToken('123456', 'c')).rejects.toThrow('Ably is not configured');
  });
});
