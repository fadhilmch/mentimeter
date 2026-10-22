import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server } from 'socket.io';
import { io as clientIo } from 'socket.io-client';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { registerPresentationSockets } from '../src/sockets/presentation.js';

let memory, httpServer, ioServer, app, port;

beforeAll(async () => {
  memory = await MongoMemoryServer.create();
  await connectDatabase(memory.getUri());
  app = createApp();
  httpServer = createServer(app);
  ioServer = new Server(httpServer);
  registerPresentationSockets(ioServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterAll(async () => {
  ioServer.close();
  httpServer.close();
  await disconnectDatabase();
  await memory.stop();
});

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

describe('live room protocol', () => {
  it('joins by code, broadcasts votes and state to the room', async () => {
    const signup = await request(app).post('/api/users/signup').send({ username: `u${Date.now()}`, password: 'super-secret-1' });
    const created = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${signup.body.token}`)
      .send({ title: 'Live', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] });

    const accessCode = created.body.data.accessCode;
    const audience = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    const presenter = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });

    const joined = await emit(audience, 'presentation:join', { accessCode });
    expect(joined.ok).toBe(true);
    expect(joined.state.title).toBe('Live');
    await emit(presenter, 'presentation:join', { accessCode });

    const presenterSees = new Promise((resolve) => presenter.on('presentation:state', resolve));
    const voted = await emit(audience, 'live:action', { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'participant-1' });
    expect(voted.ok).toBe(true);

    const state = await presenterSees;
    expect(state.slides[0].tally).toEqual({ total: 1, counts: [0, 1], percentages: [0, 100] });

    const badJoin = await emit(audience, 'presentation:join', { accessCode: '999999' });
    expect(badJoin.ok).toBe(false);

    // Slide control is not available to anyone on the public socket.
    const slideChange = await emit(audience, 'live:action', { type: 'slide:change', slideIndex: 0 });
    expect(slideChange.ok).toBe(false);

    audience.close();
    presenter.close();
  }, 20000);

  it('reports connected clients separately from submitters', async () => {
    const signup = await request(app).post('/api/users/signup').send({ username: `p${Date.now()}`, password: 'super-secret-1' });
    const created = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${signup.body.token}`)
      .send({ title: 'Presence', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] });
    const accessCode = created.body.data.accessCode;
    const a = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    const b = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    const first = await emit(a, 'presentation:join', { accessCode });
    expect(first.presence.connected).toBe(1);
    const sawTwo = new Promise((resolve) => a.on('presence:update', (p) => p.connected === 2 && resolve(p)));
    const second = await emit(b, 'presentation:join', { accessCode });
    expect(second.presence.connected).toBe(2);
    await sawTwo;
    const sawOne = new Promise((resolve) => a.on('presence:update', (p) => p.connected === 1 && resolve(p)));
    b.close();
    await sawOne;
    a.close();
  });
});

describe('reconnect', () => {
  it('a client that was offline gets the newer state, with a higher revision, when it rejoins', async () => {
    const signup = await request(app).post('/api/users/signup').send({ username: `rc${Date.now()}`, password: 'super-secret-1' });
    const created = await request(app)
      .post('/api/presentations')
      .set('authorization', `Bearer ${signup.body.token}`)
      .send({ title: 'Reconnect', slides: [{ questionType: 'multiple-choice', question: 'Q?', options: ['a', 'b'] }] });
    const accessCode = created.body.data.accessCode;
    const url = `http://127.0.0.1:${port}`;

    const flaky = clientIo(url, { transports: ['websocket'] });
    const first = await emit(flaky, 'presentation:join', { accessCode });
    flaky.close(); // goes offline

    const other = clientIo(url, { transports: ['websocket'] });
    await emit(other, 'presentation:join', { accessCode });
    for (const p of ['p-reco01', 'p-reco02']) {
      expect((await emit(other, 'live:action', { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: p })).ok).toBe(true);
    }

    const back = clientIo(url, { transports: ['websocket'] });
    const second = await emit(back, 'presentation:join', { accessCode });
    expect(second.ok).toBe(true);
    expect(second.state.revision).toBeGreaterThan(first.state.revision);
    expect(second.state.slides[0].tally.total).toBe(2);
    other.close();
    back.close();
  });
});
