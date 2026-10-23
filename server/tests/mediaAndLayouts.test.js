import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp, clearCollections } from './helpers.js';
import { publicState } from '../src/lib/live.js';
import { reportSlides } from '../src/lib/report.js';
import { sniffImageType } from '../src/lib/media.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

// Smallest valid-looking headers: the server checks the first bytes, not the file name or header.
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);

async function signedIn() {
  const username = `u${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
  const res = await request(app).post('/api/users/signup').send({ username, password: 'super-secret-1' });
  return res.body.token;
}

describe('image upload', () => {
  it('stores a png and serves it back publicly with safe headers', async () => {
    const token = await signedIn();
    const up = await request(app).post('/api/media').set('Authorization', `Bearer ${token}`).set('Content-Type', 'image/png').send(png);
    expect(up.status).toBe(201);
    expect(up.body.data.url).toMatch(/^\/api\/media\/[a-f0-9]{24}$/);
    const got = await request(app).get(up.body.data.url); // no login: the audience loads it
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toContain('image/png');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(got.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.compare(got.body, png)).toBe(0);
  });

  it('needs a signed-in owner', async () => {
    const res = await request(app).post('/api/media').set('Content-Type', 'image/png').send(png);
    expect(res.status).toBe(401);
  });

  it('rejects files that only claim to be images, and svg', async () => {
    const token = await signedIn();
    const fake = await request(app).post('/api/media').set('Authorization', `Bearer ${token}`).set('Content-Type', 'image/png').send(Buffer.from('<svg onload="x()"></svg>'.padEnd(40, ' ')));
    expect(fake.status).toBe(415);
    const svg = await request(app).post('/api/media').set('Authorization', `Bearer ${token}`).set('Content-Type', 'image/svg+xml').send('<svg/>');
    expect(svg.status).toBe(415);
  });

  it('rejects an image over 600 KB', async () => {
    const token = await signedIn();
    const big = Buffer.concat([jpeg, Buffer.alloc(700 * 1024)]);
    const res = await request(app).post('/api/media').set('Authorization', `Bearer ${token}`).set('Content-Type', 'image/jpeg').send(big);
    expect(res.status).toBe(413);
  });

  it('sniffs the real type from the bytes', () => {
    expect(sniffImageType(png)).toBe('image/png');
    expect(sniffImageType(jpeg)).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from('RIFF....WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBeNull();
  });

  it('a deck accepts an uploaded image path or an https link, and nothing else', async () => {
    const token = await signedIn();
    const make = (imageUrl) => request(app).post('/api/presentations').set('Authorization', `Bearer ${token}`)
      .send({ title: 'D', slides: [{ questionType: 'open-ended', question: 'Q', design: { imageUrl } }] });
    expect((await make('/api/media/0123456789abcdef01234567')).status).toBe(201);
    expect((await make('https://example.com/a.png')).status).toBe(201);
    expect((await make('http://example.com/a.png')).status).toBe(400);
    expect((await make('javascript:alert(1)')).status).toBe(400);
    expect((await make('/api/media/../../etc/passwd')).status).toBe(400);
  });
});

describe('layout slides', () => {
  const create = async (token, slides) => request(app).post('/api/presentations').set('Authorization', `Bearer ${token}`).send({ title: 'Deck', slides });

  it('saves title, columns and image slides and shows their content to the audience', async () => {
    const token = await signedIn();
    const res = await create(token, [
      { questionType: 'title', question: 'Welcome', body: 'Q4 kickoff' },
      { questionType: 'columns', question: 'Plan', columns: [{ title: 'Now', text: 'Ship' }, { title: 'Next', text: 'Learn' }] },
      { questionType: 'image', question: 'The team', design: { imageUrl: 'https://example.com/team.png' } },
    ]);
    expect(res.status).toBe(201);
    const state = publicState({ ...res.body.data, accessCode: res.body.data.accessCode, slides: res.body.data.slides, currentSlide: 2 });
    expect(state.slides[0]).toMatchObject({ questionType: 'title', body: 'Q4 kickoff' });
    expect(state.slides[1].columns).toEqual([{ title: 'Now', text: 'Ship' }, { title: 'Next', text: 'Learn' }]);
    expect(state.slides[2].design.imageUrl).toBe('https://example.com/team.png');
    expect(state.slides[0].tally).toBeUndefined();
    expect(state.slides[0].responses).toBeUndefined();
  });

  it('validates what each layout needs', async () => {
    const token = await signedIn();
    expect((await create(token, [{ questionType: 'image', question: 'No picture' }])).status).toBe(400);
    expect((await create(token, [{ questionType: 'columns', question: 'One', columns: [{ title: 'a', text: 'b' }] }])).status).toBe(400);
    expect((await create(token, [{ questionType: 'title', question: 'T', options: ['x', 'y'] }])).status).toBe(400);
    expect((await create(token, [{ questionType: 'rating', question: 'R', timeLimit: 10 }])).status).toBe(400);
    expect((await create(token, [{ questionType: 'quiz', question: 'Q', options: ['a', 'b'], timeLimit: 2 }])).status).toBe(400);
    expect((await create(token, [{ questionType: 'quiz', question: 'Q', options: ['a', 'b'], timeLimit: 20 }])).status).toBe(201);
  });

  it('keeps layout slides out of the results report', async () => {
    const token = await signedIn();
    const res = await create(token, [
      { questionType: 'title', question: 'Welcome' },
      { questionType: 'open-ended', question: 'Thoughts?' },
    ]);
    const report = reportSlides(res.body.data.slides);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ index: 1, questionType: 'open-ended' });
  });

  it('keeps time limit, content and scoring through an edit and a duplicate', async () => {
    const token = await signedIn();
    const res = await request(app).post('/api/presentations').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Deck', quizScoring: 'speed', slides: [
        { questionType: 'quiz', question: 'Q', options: ['a', 'b'], timeLimit: 20 },
        { questionType: 'title', question: 'Hi', body: 'Sub' },
      ] });
    const deck = res.body.data;
    const put = await request(app).put(`/api/presentations/${deck._id}`).set('Authorization', `Bearer ${token}`)
      .send({ baseStructureRevision: deck.structureRevision, slides: deck.slides.map((s) => ({
        id: s.id, questionType: s.questionType, question: s.question, options: s.options.map(({ id, text }) => ({ id, text })),
        ...(s.timeLimit ? { timeLimit: s.timeLimit } : {}), ...(s.body ? { body: s.body } : {}),
      })) });
    expect(put.status).toBe(200);
    expect(put.body.data.slides[0].timeLimit).toBe(20);
    expect(put.body.data.slides[1].body).toBe('Sub');
    const dup = await request(app).post(`/api/presentations/${deck._id}/duplicate`).set('Authorization', `Bearer ${token}`);
    expect(dup.body.data.quizScoring).toBe('speed');
    expect(dup.body.data.slides[0].timeLimit).toBe(20);
    expect(dup.body.data.slides[1].body).toBe('Sub');
  });
});
