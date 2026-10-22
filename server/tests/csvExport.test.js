import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { csvCell } from '../src/lib/csvReport.js';

let app;
beforeAll(async () => { app = await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

describe('csvCell', () => {
  it('neutralises formula starts for text and leaves numbers alone', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(4.5)).toBe('4.5');
  });
  it('quotes commas, quotes and newlines; keeps unicode', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('Åsa 你好')).toBe('Åsa 你好');
    expect(csvCell(null)).toBe('');
  });
});

async function setup() {
  const t = (await request(app).post('/api/users/signup').send({ username: 'exporter', password: 'super-secret-1' })).body.token;
  const created = await request(app).post('/api/presentations').set('authorization', `Bearer ${t}`).send({
    title: '=Evil title',
    slides: [
      { questionType: 'multiple-choice', question: 'Pick', options: ['A', 'B'] },
      { questionType: 'open-ended', question: 'Why?' },
    ],
  });
  const code = created.body.data.accessCode;
  return { t, id: created.body.data._id, code };
}
const act = (code, a) => request(app).post(`/api/live/${code}/action`).send(a);

describe('GET /api/presentations/:id/export.csv', () => {
  it('exports aggregates with safe headers and no participant ids', async () => {
    const { t, id, code } = await setup();
    await act(code, { type: 'vote:cast', slideIndex: 0, optionIndex: 1, participantId: 'p-secret-voter-1' });
    const res = await request(app).get(`/api/presentations/${id}/export.csv`).set('authorization', `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-type']).toContain('utf-8');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.startsWith('\uFEFFpresentation,exported_at_utc')).toBe(true);
    expect(res.text).toContain("'=Evil title");
    expect(res.text).not.toContain('p-secret-voter-1');
    expect(res.text).toMatch(/Pick,B,votes,1,/);
  });

  it('exports open responses without author ids, neutralising formulas', async () => {
    const { t, id, code } = await setup();
    await act(code, { type: 'slide:change', slideIndex: 1 }); // public route ignores presenter actions
    await request(app).post(`/api/presentations/${id}/live-actions`).set('authorization', `Bearer ${t}`).send({ type: 'slide:change', slideIndex: 1 });
    await act(code, { type: 'response:add', slideIndex: 1, text: '=1+1', participantId: 'p-author-secret' });
    const res = await request(app).get(`/api/presentations/${id}/export.csv?kind=responses`).set('authorization', `Bearer ${t}`);
    expect(res.text).toContain("'=1+1");
    expect(res.text).not.toContain('p-author-secret');
  });

  it('leaderboard is a separate explicit kind', async () => {
    const { t, id } = await setup();
    const res = await request(app).get(`/api/presentations/${id}/export.csv?kind=leaderboard`).set('authorization', `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('rank,name,score');
  });

  it("is owner-only: 401 without sign-in and 404 for someone else's deck", async () => {
    const { id } = await setup();
    expect((await request(app).get(`/api/presentations/${id}/export.csv`)).status).toBe(401);
    const other = (await request(app).post('/api/users/signup').send({ username: 'intruder', password: 'super-secret-1' })).body.token;
    expect((await request(app).get(`/api/presentations/${id}/export.csv`).set('authorization', `Bearer ${other}`)).status).toBe(404);
  });

  it('rejects an unknown kind and a malformed id', async () => {
    const { t, id } = await setup();
    expect((await request(app).get(`/api/presentations/${id}/export.csv?kind=all`).set('authorization', `Bearer ${t}`)).status).toBe(400);
    expect((await request(app).get('/api/presentations/not-an-id/export.csv').set('authorization', `Bearer ${t}`)).status).toBe(404);
  });
});
