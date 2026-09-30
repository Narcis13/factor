import type { Replay } from '@factor/content';
import { expect, test, vi } from 'vitest';
import { botReplay } from '../src/match.ts';
import { describeSweep, sweep } from '../src/sweep.ts';

// On playback, seed 41 breaks an invariant, seed 42 ends in another state, and seed 43's replay doesn't fit.
// Seed 44's live match also sent two commands the sim refused. Seed 40 is left alone.
vi.mock('../src/match.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/match.ts')>();
  return {
    ...original,
    playReplay: (replay: Replay, stopTick?: number, onStep?: Parameters<typeof original.playReplay>[2]) => {
      if (replay.seed === 41) {
        throw new original.InvariantError('Invariants broken at tick 7:\n  unit 9 is in the river');
      }
      if (replay.seed === 43) {
        throw new Error('The match ended at tick 5 with 3 commands unplayed');
      }
      return original.playReplay(replay, replay.seed === 42 ? 100 : stopTick, onStep);
    },
    playBotReplay: (seed: number) => {
      const live = original.playBotReplay(seed);
      if (seed !== 44) {
        return live;
      }
      const refused = [
        { tick: 0, side: 0 as const, handSlot: 9, x: 1000, y: 1000 },
        { tick: 0, side: 1 as const, handSlot: 0, x: -1, y: 1000 },
      ];
      const replay = { ...live.replay, commands: [...refused, ...live.replay.commands] };
      return { replay, state: original.playReplay(replay) };
    },
  };
});

const report = sweep(40, 5);

test('a match that breaks an invariant is a violation, and the sweep goes on', () => {
  expect(report.violations).toEqual([{ seed: 41, message: 'Invariants broken at tick 7:\n  unit 9 is in the river' }]);
});

test('a replay that ends somewhere else than its live match, or doesn’t fit it, is a mismatch', () => {
  expect(report.mismatches.map((failure) => failure.seed)).toEqual([42, 43]);
  expect(report.mismatches[0]?.message).toMatch(/^live match hashed [0-9a-f]{8}, its replay [0-9a-f]{8}$/);
  expect(report.mismatches[1]?.message).toBe('The match ended at tick 5 with 3 commands unplayed');
});

test('refused commands are counted by reason and not as plays', () => {
  expect(report.rejected).toEqual({ 'bad-slot': 1, 'out-of-bounds': 1 });
  // The bots' own commands are all taken, so the plays are exactly those of seeds 40 and 44.
  const sent = botReplay(40).commands.length + botReplay(44).commands.length;
  expect(Object.values(report.plays).reduce((sum, count) => sum + count, 0)).toBe(sent);
});

test('failing matches stay out of the tallies', () => {
  const [first, last] = [sweep(40, 1), sweep(44, 1)];
  expect(report.wins[0] + report.wins[1] + report.draws).toBe(2);
  expect(report.totalTicks).toBe(first.totalTicks + last.totalTicks);
  expect(report.stars).toEqual([first.stars[0] + last.stars[0], first.stars[1] + last.stars[1]]);
  expect(report.shortest).toBe(Math.min(first.shortest, last.shortest));
  expect(report.longest).toBe(Math.max(first.longest, last.longest));
});

test('the report names each failing seed with the command that reproduces it', () => {
  const text = describeSweep(report);
  expect(text).toContain('seeds       40..44 (5 matches, 2 healthy)');
  expect(text).toContain('rejected    bad-slot 1 · out-of-bounds 1');
  expect(text).toContain('violations  1\nmismatches  2');
  expect(text).toContain('violation at seed 41 (pnpm sim match --seed 41):\n  Invariants broken at tick 7:\n    unit 9 is in the river');
  expect(text).toContain('mismatch at seed 42 (pnpm sim match --seed 42):\n  live match hashed ');
  expect(text).toContain('mismatch at seed 43 (pnpm sim match --seed 43):\n  The match ended at tick 5');
});
