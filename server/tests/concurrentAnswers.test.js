import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearCollections, setupTestApp, teardownTestApp } from './helpers.js';
import { User } from '../src/models/user.js';
import { Presentation } from '../src/models/presentation.js';
import { applyLiveActionByCode } from '../src/lib/live.js';

beforeAll(async () => { await setupTestApp(); });
afterAll(teardownTestApp);
beforeEach(clearCollections);

describe('a burst of simultaneous answers', () => {
  it('accepts every one of 200 votes in a single process, with no raw database errors', async () => {
    const owner = await User.create({ name: 'B', username: 'burst', passwordHash: 'x' });
    await Presentation.create({ owner: owner._id, title: 'T', accessCode: '555555', slides: [{ questionType: 'multiple-choice', question: 'Q', options: [{ text: 'A' }, { text: 'B' }] }] });
    const results = await Promise.allSettled(
      Array.from({ length: 200 }, (_, i) => applyLiveActionByCode('555555', { type: 'vote:cast', slideIndex: 0, optionIndex: i % 2, participantId: `p-burst-${i}` })),
    );
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    const doc = await Presentation.findOne({ accessCode: '555555' });
    expect(doc.slides[0].options[0].votes.length + doc.slides[0].options[1].votes.length).toBe(200);
  });

  it('keeps one presentation failing from blocking the next action', async () => {
    const owner = await User.create({ name: 'B', username: 'burst2', passwordHash: 'x' });
    await Presentation.create({ owner: owner._id, title: 'T', accessCode: '666666', slides: [{ questionType: 'multiple-choice', question: 'Q', options: [{ text: 'A' }, { text: 'B' }] }] });
    await expect(applyLiveActionByCode('666666', { type: 'vote:cast', slideIndex: 0, optionIndex: 9, participantId: 'p-bad-1' })).rejects.toThrow();
    await expect(applyLiveActionByCode('666666', { type: 'vote:cast', slideIndex: 0, optionIndex: 0, participantId: 'p-good-1' })).resolves.toBeTruthy();
  });
});
