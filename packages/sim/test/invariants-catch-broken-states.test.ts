import { expect, test } from 'vitest';
import { checkInvariants, type SimState } from '../src/index.ts';
import { idle, newMatch } from './fixtures.ts';

// 100 ticks of regulation and 40 of overtime, so the timer runs out at tick 140.
const healthy = newMatch(3, { regulationTicks: 100, overtimeTicks: 40 });

test('a fresh match and a finished match are healthy', () => {
  expect(checkInvariants(healthy)).toEqual([]);
  expect(checkInvariants(idle(healthy, 140))).toEqual([]);
});

test.each<{ label: string; broken: SimState; message: RegExp }>([
  { label: 'a tick past the end', broken: { ...healthy, tick: 141 }, message: /tick 141 is outside/ },
  { label: 'a negative tick', broken: { ...healthy, tick: -1 }, message: /tick -1 is outside/ },
  {
    label: 'no result when the timer runs out',
    broken: { ...healthy, tick: 140 },
    message: /timer ran out/,
  },
  {
    label: 'an rng word that is not a uint32',
    broken: { ...healthy, rng: { ...healthy.rng, c: -1 } },
    message: /rng\.c -1/,
  },
  { label: 'negative stars', broken: { ...healthy, stars: [0, -1] }, message: /side 1 has -1 stars/ },
  {
    label: 'a draw with untied stars',
    broken: { ...healthy, stars: [1, 0], result: { winner: null } },
    message: /draw with stars 1-0/,
  },
  {
    label: 'a winner with fewer stars',
    broken: { ...healthy, stars: [0, 1], result: { winner: 0 } },
    message: /side 0 won with fewer stars/,
  },
])('$label is a violation', ({ broken, message }) => {
  const violations = checkInvariants(broken);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatch(message);
});
