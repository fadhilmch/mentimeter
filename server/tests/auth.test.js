import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp, clearCollections } from './helpers.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

const user = { name: 'Fadhil', username: 'fadhil', password: 'super-secret-1' };

describe('auth routes', () => {
  it('signs up, logs in, and rejects wrong passwords', async () => {
    const signup = await request(app).post('/api/users/signup').send(user).expect(201);
    expect(signup.body.token).toBeTruthy();
    expect(signup.body.user.username).toBe('fadhil');
    expect(signup.body.user.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/users/login').send({ username: 'fadhil', password: user.password }).expect(200);
    expect(login.body.token).toBeTruthy();

    await request(app).post('/api/users/login').send({ username: 'fadhil', password: 'wrong-password' }).expect(401);
  });

  it('rejects duplicate usernames and short passwords', async () => {
    await request(app).post('/api/users/signup').send(user).expect(201);
    await request(app).post('/api/users/signup').send(user).expect(409);
    await request(app).post('/api/users/signup').send({ username: 'other', password: 'short' }).expect(400);
  });

  describe('account deletion', () => {
    it('deletes the account and its presentations after the password is confirmed', async () => {
      const signup = await request(app).post('/api/users/signup').send(user).expect(201);
      const auth = { Authorization: `Bearer ${signup.body.token}` };
      await request(app).post('/api/presentations').set(auth)
        .send({ title: 'Mine', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: [{ text: 'A' }, { text: 'B' }] }] }).expect(201);

      await request(app).delete('/api/users/me').set(auth).send({ password: 'wrong-password' }).expect(403);
      const gone = await request(app).delete('/api/users/me').set(auth).send({ password: user.password }).expect(200);
      expect(gone.body.deletedPresentations).toBe(1);

      await request(app).post('/api/users/login').send({ username: 'fadhil', password: user.password }).expect(401);
      await request(app).get('/api/presentations').set(auth).expect(401);
    });

    it('needs a signed-in user and does not touch other accounts', async () => {
      await request(app).delete('/api/users/me').send({ password: 'x' }).expect(401);
      const other = await request(app).post('/api/users/signup').send({ username: 'other', password: 'other-secret-1' }).expect(201);
      const signup = await request(app).post('/api/users/signup').send(user).expect(201);
      await request(app).delete('/api/users/me').set({ Authorization: `Bearer ${signup.body.token}` }).send({ password: user.password }).expect(200);
      await request(app).post('/api/users/login').send({ username: 'other', password: 'other-secret-1' }).expect(200);
      expect(other.body.token).toBeTruthy();
    });
  });
});
