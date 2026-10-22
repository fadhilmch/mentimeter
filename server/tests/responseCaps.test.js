import { afterEach, describe, expect, it } from 'vitest';
import { addResponse } from '../src/lib/results.js';

const slide = () => ({ questionType: 'open-ended', question: 'Q', options: [], responses: [] });
afterEach(() => { delete process.env.LIVE_MAX_RESPONSES_PER_PARTICIPANT; delete process.env.LIVE_MAX_RESPONSES_PER_SLIDE; });

describe('open-ended volume caps', () => {
  it('stops one participant at the per-person cap but not others', () => {
    process.env.LIVE_MAX_RESPONSES_PER_PARTICIPANT = '3';
    const s = slide();
    for (let i = 0; i < 3; i += 1) addResponse(s, `r${i}`, 'p-aaaaaa');
    expect(() => addResponse(s, 'one more', 'p-aaaaaa')).toThrow(/up to 3/);
    expect(() => addResponse(s, 'fine', 'p-bbbbbb')).not.toThrow();
  });
  it('stops the slide at the total cap', () => {
    process.env.LIVE_MAX_RESPONSES_PER_SLIDE = '2';
    const s = slide();
    addResponse(s, 'a', 'p-aaaaaa');
    addResponse(s, 'b', 'p-bbbbbb');
    expect(() => addResponse(s, 'c', 'p-cccccc')).toThrow(/limit of responses/);
  });
  it('a retry of an already stored send is not counted again', () => {
    process.env.LIVE_MAX_RESPONSES_PER_PARTICIPANT = '1';
    const s = slide();
    addResponse(s, 'a', 'p-aaaaaa', 'client-id-1');
    expect(() => addResponse(s, 'a', 'p-aaaaaa', 'client-id-1')).not.toThrow();
    expect(s.responses).toHaveLength(1);
  });
});
