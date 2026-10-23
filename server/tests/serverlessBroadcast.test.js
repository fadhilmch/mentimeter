import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ably.js', () => ({ publishState: vi.fn(async () => true) }));

const { broadcastState, setBroadcaster } = await import('../src/lib/broadcast.js');
const { publishState } = await import('../src/ably.js');

beforeEach(() => {
  publishState.mockClear();
  setBroadcaster(null);
});

describe('presenter broadcasts without the socket layer (serverless)', () => {
  it('publishes the saved state to Ably when no socket broadcaster is registered', async () => {
    const state = { currentSlide: 2 };
    await broadcastState('123456', state);
    expect(publishState).toHaveBeenCalledWith('123456', state);
  });

  it('leaves publication to the socket layer when it is running (no double publish)', async () => {
    const socketBroadcast = vi.fn();
    setBroadcaster(socketBroadcast);
    await broadcastState('123456', { currentSlide: 2 });
    expect(socketBroadcast).toHaveBeenCalledWith('123456');
    expect(publishState).not.toHaveBeenCalled();
  });
});

describe('publish failure after a successful save', () => {
  it('does not turn the saved change into an error', async () => {
    publishState.mockRejectedValueOnce(new Error('ably down'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(broadcastState('123456', { currentSlide: 1 })).resolves.toBeUndefined();
    quiet.mockRestore();
  });
});

it('passes a saved terminal snapshot to sockets before its session code is released', async () => {
  const socketBroadcast = vi.fn();
  setBroadcaster(socketBroadcast);
  const state = { ended: true, votingOpen: false };
  await broadcastState('123456', state);
  expect(socketBroadcast).toHaveBeenCalledWith('123456', state);
});
