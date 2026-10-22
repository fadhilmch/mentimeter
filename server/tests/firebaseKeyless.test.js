import { afterEach, describe, expect, it } from 'vitest';
import { canCheckRevocation, canDeleteFirebaseUsers, deleteFirebaseUser, setFirebaseAuthForTests, verifyFirebaseToken } from '../src/lib/firebase.js';
import { config } from '../src/config.js';

describe('Firebase login removal without a service account', () => {
  const saved = { json: config.firebase.serviceAccountJson, emu: process.env.FIREBASE_AUTH_EMULATOR_HOST };
  afterEach(() => {
    setFirebaseAuthForTests(undefined);
    config.firebase.serviceAccountJson = saved.json;
    if (saved.emu === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = saved.emu;
  });

  it('reports that it cannot remove the login, and does not call Firebase', async () => {
    config.firebase.serviceAccountJson = '';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    config.firebase.projectId = '';
    expect(canDeleteFirebaseUsers()).toBe(false);
    expect(await deleteFirebaseUser('uid1')).toBe(false);
  });

  it('removes the login when an admin client is available', async () => {
    const calls = [];
    setFirebaseAuthForTests({ deleteUser: async (uid) => calls.push(uid) });
    expect(canDeleteFirebaseUsers()).toBe(true);
    expect(await deleteFirebaseUser('uid1')).toBe(true);
    expect(calls).toEqual(['uid1']);
  });

  it('treats an already-deleted login as removed', async () => {
    setFirebaseAuthForTests({ deleteUser: async () => { throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' }); } });
    expect(await deleteFirebaseUser('uid1')).toBe(true);
  });

  it('does not use the Admin revocation lookup without a credential', () => {
    config.firebase.serviceAccountJson = '';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    expect(canCheckRevocation()).toBe(false);
  });

  it('asks for the revocation check when an admin client is available', async () => {
    const seen = [];
    setFirebaseAuthForTests({ verifyIdToken: async (_t, revoked) => { seen.push(revoked); return { uid: 'u1' }; } });
    await verifyFirebaseToken('t', { checkRevoked: true });
    await verifyFirebaseToken('t');
    expect(seen).toEqual([true, false]);
  });
});
