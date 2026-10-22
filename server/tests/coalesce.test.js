import { describe, it, expect } from 'vitest';
import { createCoalescer } from '../src/lib/coalesce.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('createCoalescer', () => {
  it('runs every call when disabled', async () => {
    let runs = 0;
    const c = createCoalescer(async () => { runs += 1; }, 0);
    await Promise.all([c('a'), c('a'), c('a')]);
    expect(runs).toBe(3);
  });
  it('collapses a burst into a leading run and one trailing run', async () => {
    let runs = 0;
    const c = createCoalescer(async () => { runs += 1; await sleep(5); }, 50);
    await Promise.all(Array.from({ length: 20 }, () => c('a')));
    expect(runs).toBe(2);
  });
  it('keeps keys independent and runs again after a quiet period', async () => {
    let runs = 0;
    const c = createCoalescer(async () => { runs += 1; }, 20);
    await Promise.all([c('a'), c('b')]);
    expect(runs).toBe(2);
    await sleep(60);
    await c('a');
    expect(runs).toBe(3);
  });
  it('gives a caller a run that started after its call', async () => {
    const started = [];
    const c = createCoalescer(async () => { started.push(Date.now()); await sleep(10); }, 30);
    await c('a');
    const callAt = Date.now();
    await c('a');
    expect(started[started.length - 1]).toBeGreaterThanOrEqual(callAt);
  });
});
