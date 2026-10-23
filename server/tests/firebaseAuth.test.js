import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp, clearCollections } from './helpers.js';
import { config } from '../src/config.js';
import { setFirebaseAuthForTests } from '../src/lib/firebase.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';

// A stand-in for firebase-admin: tokens look like "fb|<uid>|<email>|<secondsSinceSignIn>".
const deleted = [];
let failDelete = false;
const revoked = new Set();
const fakeAuth = {
  async verifyIdToken(token, checkRevoked) {
    const [tag, uid, email, ago] = token.split('|');
    if (tag !== 'fb') throw new Error('bad token');
    if (checkRevoked && revoked.has(uid)) throw new Error('revoked');
    return { uid, email, email_verified: false, auth_time: Math.floor(Date.now() / 1000) - Number(ago ?? 0) };
  },
  async deleteUser(uid) {
    if (failDelete) throw new Error('firebase down');
    deleted.push(uid);
  },
};
const tok = (uid, email, ago = 0) => `fb|${uid}|${email}|${ago}`;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const slide = { questionType: 'multiple-choice', question: 'Q?', options: [{ text: 'A' }, { text: 'B' }] };

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(async () => {
  await clearCollections();
  config.firebase.projectId = 'demo-crowdflow';
  setFirebaseAuthForTests(fakeAuth);
  deleted.length = 0; failDelete = false; revoked.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  config.firebase.projectId = '';
  setFirebaseAuthForTests(undefined);
  vi.restoreAllMocks();
});

describe('Firebase sign-in', () => {
  it('creates a profile once, and presenting works with the Firebase token', async () => {
    const t = tok('uid1', 'Ada@Example.com');
    // Signed in but no profile yet: protected routes ask for it, and do not sign the person out.
    const blocked = await request(app).get('/api/presentations').set(bearer(t)).expect(403);
    expect(blocked.body.code).toBe('PROFILE_REQUIRED');
    await request(app).get('/api/users/me').set(bearer(t)).expect(404);

    const made = await request(app).post('/api/users/profile').set(bearer(t)).send({ name: 'Ada' }).expect(201);
    expect(made.body.user).toMatchObject({ name: 'Ada', email: 'ada@example.com', username: null });
    const again = await request(app).post('/api/users/profile').set(bearer(t)).send({ name: 'Other' }).expect(200);
    expect(again.body.user.name).toBe('Ada');
    expect(await User.countDocuments()).toBe(1);

    await request(app).post('/api/presentations').set(bearer(t)).send({ title: 'Mine', slides: [slide] }).expect(201);
    const list = await request(app).get('/api/presentations').set(bearer(t)).expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('rejects bad tokens and keeps people apart', async () => {
    await request(app).get('/api/presentations').set(bearer('fb-garbage')).expect(401);
    await request(app).get('/api/presentations').expect(401);
    await request(app).post('/api/users/profile').set(bearer(tok('a', 'a@x.com'))).send({ name: 'A' }).expect(201);
    await request(app).post('/api/users/profile').set(bearer(tok('b', 'b@x.com'))).send({ name: 'B' }).expect(201);
    await request(app).post('/api/presentations').set(bearer(tok('a', 'a@x.com'))).send({ title: 'A only', slides: [slide] }).expect(201);
    const other = await request(app).get('/api/presentations').set(bearer(tok('b', 'b@x.com'))).expect(200);
    expect(other.body.data).toHaveLength(0);
  });

  it('a duplicate email cannot take over another profile', async () => {
    await request(app).post('/api/users/profile').set(bearer(tok('a', 'a@x.com'))).send({ name: 'A' }).expect(201);
    await request(app).post('/api/users/profile').set(bearer(tok('b', 'a@x.com'))).send({ name: 'B' }).expect(409);
  });

  it('closes the built-in signup and login, but old session tokens still work until they expire', async () => {
    config.firebase.projectId = '';
    const signup = await request(app).post('/api/users/signup').send({ name: 'Old', username: 'olduser', password: 'password-1' }).expect(201);
    config.firebase.projectId = 'demo-crowdflow';
    await request(app).post('/api/users/signup').send({ username: 'newuser', password: 'password-1' }).expect(410);
    await request(app).post('/api/users/login').send({ username: 'olduser', password: 'password-1' }).expect(410);
    await request(app).get('/api/presentations').set(bearer(signup.body.token)).expect(200);
  });
});

describe('moving an old username account', () => {
  async function legacyWithPresentation() {
    const user = await User.create({ name: 'Old', username: 'olduser', passwordHash: await bcrypt.hash('password-1', 4) });
    await Presentation.create({ owner: user._id, title: 'Kept', accessCode: '111111', slides: [slide] });
    return user;
  }

  it('keeps the same owner id and presentations, and retires the password hash', async () => {
    const old = await legacyWithPresentation();
    const t = tok('uid9', 'old@example.com');
    const res = await request(app).post('/api/users/claim-legacy').set(bearer(t)).send({ username: 'OldUser', password: 'password-1' }).expect(200);
    expect(res.body.user.id).toBe(String(old._id));
    const stored = await User.findById(old._id);
    expect(stored.firebaseUid).toBe('uid9');
    expect(stored.email).toBe('old@example.com');
    expect(stored.passwordHash).toBeUndefined();
    const list = await request(app).get('/api/presentations').set(bearer(t)).expect(200);
    expect(list.body.data.map((p) => p.title)).toEqual(['Kept']);
  });

  it('rejects a wrong password or unknown username the same way, without signing out', async () => {
    await legacyWithPresentation();
    const t = tok('uid9', 'old@example.com');
    const wrong = await request(app).post('/api/users/claim-legacy').set(bearer(t)).send({ username: 'olduser', password: 'nope-nope' }).expect(403);
    const unknown = await request(app).post('/api/users/claim-legacy').set(bearer(t)).send({ username: 'ghost', password: 'password-1' }).expect(403);
    expect(wrong.body).toEqual(unknown.body);
    expect((await User.findOne({ username: 'olduser' })).firebaseUid).toBeUndefined();
  });

  it('cannot be claimed twice, and a login that already has a profile cannot claim', async () => {
    await legacyWithPresentation();
    await request(app).post('/api/users/claim-legacy').set(bearer(tok('uid9', 'a@x.com'))).send({ username: 'olduser', password: 'password-1' }).expect(200);
    await request(app).post('/api/users/claim-legacy').set(bearer(tok('uid10', 'b@x.com'))).send({ username: 'olduser', password: 'password-1' }).expect(403);
    await request(app).post('/api/users/profile').set(bearer(tok('uid11', 'c@x.com'))).send({ name: 'C' }).expect(201);
    await User.create({ name: 'Two', username: 'two', passwordHash: await bcrypt.hash('password-2', 4) });
    await request(app).post('/api/users/claim-legacy').set(bearer(tok('uid11', 'c@x.com'))).send({ username: 'two', password: 'password-2' }).expect(409);
  });
});

describe('deleting a Firebase account', () => {
  async function signedUp(uid = 'uid1', email = 'ada@example.com') {
    await request(app).post('/api/users/profile').set(bearer(tok(uid, email))).send({ name: 'Ada' }).expect(201);
    await request(app).post('/api/presentations').set(bearer(tok(uid, email))).send({ title: 'Mine', slides: [slide] }).expect(201);
  }

  it('needs a recent sign-in, then removes presentations, the profile and the Firebase user', async () => {
    await signedUp();
    const stale = await request(app).delete('/api/users/me').set(bearer(tok('uid1', 'ada@example.com', 3600))).send({}).expect(403);
    expect(stale.body.code).toBe('REAUTH_REQUIRED');
    expect(await User.countDocuments()).toBe(1);

    const t = tok('uid1', 'ada@example.com', 10);
    const gone = await request(app).delete('/api/users/me').set(bearer(t)).send({}).expect(200);
    expect(gone.body).toEqual({ ok: true, deletedPresentations: 1, firebaseLoginRemoved: true });
    expect(await User.countDocuments()).toBe(0);
    expect(await Presentation.countDocuments()).toBe(0);
    expect(deleted).toEqual(['uid1']);
  });

  it('refuses a revoked token', async () => {
    await signedUp();
    revoked.add('uid1');
    await request(app).delete('/api/users/me').set(bearer(tok('uid1', 'ada@example.com', 10))).send({}).expect(401);
    expect(await User.countDocuments()).toBe(1);
  });

  it('reports an incomplete delete when Firebase fails, and a repeat finishes it', async () => {
    await signedUp();
    const t = tok('uid1', 'ada@example.com', 10);
    failDelete = true;
    const failed = await request(app).delete('/api/users/me').set(bearer(t)).send({}).expect(500);
    expect(failed.body.code).toBe('ACCOUNT_DELETE_INCOMPLETE');
    expect(await Presentation.countDocuments()).toBe(0);
    failDelete = false;
    await request(app).delete('/api/users/me').set(bearer(t)).send({}).expect(200);
    expect(deleted).toEqual(['uid1']);
  });

  it('still works for the old password-confirmed delete', async () => {
    config.firebase.projectId = '';
    const signup = await request(app).post('/api/users/signup').send({ username: 'olduser', password: 'password-1' }).expect(201);
    config.firebase.projectId = 'demo-crowdflow';
    const h = bearer(signup.body.token);
    await request(app).delete('/api/users/me').set(h).send({}).expect(403);
    await request(app).delete('/api/users/me').set(h).send({ password: 'password-1' }).expect(200);
  });
});

describe('old session tokens and token policy', () => {
  it('stops accepting the old 7-day token as soon as the account moves to Firebase', async () => {
    config.firebase.projectId = '';
    const signup = await request(app).post('/api/users/signup').send({ username: 'olduser', password: 'password-1' }).expect(201);
    config.firebase.projectId = 'demo-crowdflow';
    const old = bearer(signup.body.token);
    await request(app).get('/api/presentations').set(old).expect(200);
    await request(app).post('/api/users/claim-legacy').set(bearer(tok('uid9', 'old@example.com'))).send({ username: 'olduser', password: 'password-1' }).expect(200);
    await request(app).get('/api/presentations').set(old).expect(401);
    await request(app).delete('/api/users/me').set(old).send({ password: 'password-1' }).expect(401);
    await request(app).get('/api/presentations').set(bearer(tok('uid9', 'old@example.com'))).expect(200);
  });

  it('repeating a move that already succeeded is fine, a different username is not', async () => {
    await User.create({ name: 'Old', username: 'olduser', passwordHash: await bcrypt.hash('password-1', 4) });
    const t = bearer(tok('uid9', 'old@example.com'));
    const first = await request(app).post('/api/users/claim-legacy').set(t).send({ username: 'olduser', password: 'password-1' }).expect(200);
    const again = await request(app).post('/api/users/claim-legacy').set(t).send({ username: 'olduser', password: 'anything-at-all' }).expect(200);
    expect(again.body.user.id).toBe(first.body.user.id);
    await request(app).post('/api/users/claim-legacy').set(t).send({ username: 'someoneelse', password: 'anything-at-all' }).expect(409);
  });

  it('only HS256 counts as an old token: wrong secret, other algorithms and unsigned tokens are refused', async () => {
    config.firebase.projectId = '';
    const user = await User.create({ name: 'Old', username: 'olduser', passwordHash: await bcrypt.hash('password-1', 4) });
    const jwt = (await import('jsonwebtoken')).default;
    const forged = [
      jwt.sign({ sub: String(user._id) }, 'not-the-secret', { algorithm: 'HS256' }),
      jwt.sign({ sub: String(user._id) }, config.jwtSecret, { algorithm: 'HS512' }),
      `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: String(user._id) })).toString('base64url')}.`,
    ];
    for (const t of forged) {
      await request(app).get('/api/presentations').set(bearer(t)).expect(401);
      config.firebase.projectId = 'demo-crowdflow';
      await request(app).get('/api/presentations').set(bearer(t)).expect(401);
      config.firebase.projectId = '';
    }
  });

  it('revocation is checked on profile, move and delete, not on every ordinary request (documented policy)', async () => {
    await request(app).post('/api/users/profile').set(bearer(tok('uid1', 'ada@example.com'))).send({ name: 'Ada' }).expect(201);
    revoked.add('uid1');
    const t = bearer(tok('uid1', 'ada@example.com', 5));
    await request(app).get('/api/presentations').set(t).expect(200);
    await request(app).delete('/api/users/me').set(t).send({}).expect(401);
    await request(app).post('/api/users/claim-legacy').set(t).send({ username: 'x1x', password: 'y' }).expect(401);
  });
});

describe('Firebase accounts and the username index', () => {
  it('gets a hidden placeholder username, and two Firebase accounts can coexist', async () => {
    const a = await request(app).post('/api/users/profile').set(bearer(tok('uidA', 'a@x.com'))).send({ name: 'A' }).expect(201);
    await request(app).post('/api/users/profile').set(bearer(tok('uidB', 'b@x.com'))).send({ name: 'B' }).expect(201);
    expect(a.body.user.username).toBeNull();
    const stored = await User.findOne({ firebaseUid: 'uidA' });
    expect(stored.username).toMatch(/^fb-[0-9a-f]{24}$/);
    // The placeholder cannot be used to claim or log in as a Firebase account.
    await request(app).post('/api/users/claim-legacy').set(bearer(tok('uidC', 'c@x.com'))).send({ username: stored.username, password: 'whatever1' }).expect(403);
  });

  it('keeps the original username index (unique, not sparse) so an existing database needs no index change', async () => {
    await User.init();
    const idx = (await User.collection.indexes()).find((i) => i.name === 'username_1');
    expect(idx.unique).toBe(true);
    expect(idx.sparse).toBeUndefined();
    expect(idx.partialFilterExpression).toBeUndefined();
  });
});

describe('repeats and races', () => {
  it('a legacy username that starts with fb- can be moved and the move can be repeated', async () => {
    await User.create({ name: 'Old', username: 'fb-alice', passwordHash: await bcrypt.hash('password-1', 4) });
    const t = bearer(tok('uidF', 'f@x.com'));
    const first = await request(app).post('/api/users/claim-legacy').set(t).send({ username: 'fb-alice', password: 'password-1' }).expect(200);
    const again = await request(app).post('/api/users/claim-legacy').set(t).send({ username: 'fb-alice', password: 'lost-answer-replay' }).expect(200);
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  it('a profile that is not a move is never treated as a repeat of one', async () => {
    const made = await request(app).post('/api/users/profile').set(bearer(tok('uidP', 'p@x.com'))).send({ name: 'P' }).expect(201);
    const stored = await User.findById(made.body.user.id);
    await request(app).post('/api/users/claim-legacy').set(bearer(tok('uidP', 'p@x.com'))).send({ username: stored.username, password: 'x1x2x3x4' }).expect(409);
  });

  it('two tabs creating the same profile at once both get the same profile, and only one exists', async () => {
    const t = bearer(tok('uidR', 'r@x.com'));
    const [a, b] = await Promise.all([
      request(app).post('/api/users/profile').set(t).send({ name: 'R' }),
      request(app).post('/api/users/profile').set(t).send({ name: 'R' }),
    ]);
    expect([a.status, b.status].sort()).toEqual(expect.arrayContaining([expect.any(Number)]));
    expect([a.status, b.status].every((s) => s === 200 || s === 201)).toBe(true);
    expect(a.body.user.id).toBe(b.body.user.id);
    expect(await User.countDocuments({ firebaseUid: 'uidR' })).toBe(1);
  });

  it('a different login holding the email is still a conflict', async () => {
    await request(app).post('/api/users/profile').set(bearer(tok('u1', 'same@x.com'))).send({ name: 'One' }).expect(201);
    await request(app).post('/api/users/profile').set(bearer(tok('u2', 'same@x.com'))).send({ name: 'Two' }).expect(409);
  });
});
