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
});
