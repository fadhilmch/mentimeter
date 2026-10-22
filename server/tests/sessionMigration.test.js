import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';
import { LiveSession } from '../src/models/liveSession.js';
import { migrateLegacySessions } from '../src/lib/sessionMigration.js';

beforeAll(async () => { await setupTestApp(); await LiveSession.init(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

async function seed(code = '111111') {
  const owner = await User.create({ name: 'O', username: `o${code}`, passwordHash: 'x' });
  return Presentation.create({
    owner: owner._id, title: 'Deck', accessCode: code, currentSlide: 1, votingOpen: false, resultsVisible: false,
    participants: [{ participantId: 'p-aaaaaa', nickname: 'Ada' }],
    slides: [
      { id: 's1', questionType: 'quiz', question: 'Q', revealed: true, correctOptionId: 'o1', options: [{ id: 'o1', text: 'A', votes: ['p-aaaaaa'] }, { id: 'o2', text: 'B', votes: [] }] },
      { id: 's2', questionType: 'open-ended', question: 'Why', responses: [{ text: 'because', authorId: 'p-aaaaaa', upvotes: ['p-bbbbbb'] }] },
    ],
  });
}

describe('legacy session migration preview', () => {
  it('dry run counts and writes nothing', async () => {
    await seed('111111'); await seed('222222');
    const report = await migrateLegacySessions();
    expect(report).toMatchObject({ apply: false, decks: 2, wouldCreate: 2, created: 0 });
    expect(await LiveSession.countDocuments()).toBe(0);
  });

  it('keeps code, owner, votes, responses, reveal locks and state', async () => {
    const deck = await seed();
    const report = await migrateLegacySessions({ apply: true });
    expect(report).toMatchObject({ created: 1, errors: [] });
    const s = await LiveSession.findOne({ legacyOf: deck._id }).lean();
    expect(s).toMatchObject({ code: '111111', status: 'active', currentSlide: 1, votingOpen: false, resultsVisible: false, title: 'Deck' });
    expect(String(s.owner)).toBe(String(deck.owner));
    expect(s.slides[0]).toMatchObject({ revealed: true, correctOptionId: 'o1' });
    expect(s.slides[0].options[0].votes).toEqual(['p-aaaaaa']);
    expect(s.slides[1].responses[0]).toMatchObject({ text: 'because', upvotes: ['p-bbbbbb'] });
    expect(s.participants).toEqual([{ participantId: 'p-aaaaaa', nickname: 'Ada' }]);
    // The deck is untouched.
    const after = await Presentation.findById(deck._id).lean();
    expect(after.slides[0].options[0].votes).toEqual(['p-aaaaaa']);
  });

  it('can be run again, and twice at once, without duplicates', async () => {
    await seed('111111'); await seed('222222'); await seed('333333');
    await Promise.all([migrateLegacySessions({ apply: true }), migrateLegacySessions({ apply: true })]);
    const again = await migrateLegacySessions({ apply: true });
    expect(again).toMatchObject({ created: 0, alreadyMigrated: 3, errors: [] });
    expect(await LiveSession.countDocuments()).toBe(3);
  });

  it('a code is held by one active session; an ended one releases it', async () => {
    const deck = await seed();
    await migrateLegacySessions({ apply: true });
    const base = { owner: deck.owner, presentation: deck._id, title: 'Deck', code: '111111' };
    await expect(LiveSession.create(base)).rejects.toMatchObject({ code: 11000 });
    await LiveSession.updateOne({ legacyOf: deck._id }, { status: 'ended', endedAt: new Date() });
    await expect(LiveSession.create(base)).resolves.toBeTruthy();
  });
});
