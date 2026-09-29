import { expect, test } from 'vitest';
import { checkInvariants, type SimState, type Tower } from '../src/index.ts';
import { idle, newMatch } from './fixtures.ts';

// 100 ticks of regulation and 40 of overtime, so the timer runs out at tick 140.
const healthy = newMatch(3, { regulationTicks: 100, overtimeTicks: 40 });

function withTower(index: number, change: Partial<Tower>): Tower[] {
  return healthy.towers.map((tower, i) => (i === index ? { ...tower, ...change } : tower));
}

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
  {
    label: 'a tower above its max hp',
    broken: { ...healthy, towers: withTower(1, { hp: 201 }) },
    message: /tower 1 has hp 201 of 200/,
  },
  {
    label: 'a tower below 0 hp',
    broken: { ...healthy, towers: withTower(1, { hp: -1 }) },
    message: /tower 1 has hp -1/,
  },
  {
    label: 'a duplicate tower id',
    broken: { ...healthy, towers: withTower(2, { id: 1 }) },
    message: /tower 1 breaks unique ascending ids/,
  },
  {
    label: 'a tower sticking out of the arena',
    broken: { ...healthy, towers: withTower(0, { x: 999 }) },
    message: /tower 0 \(999, 2000\) size 2000 is not inside the arena/,
  },
  {
    label: 'a tower past the far edge',
    broken: { ...healthy, towers: withTower(3, { y: 19_001 }) },
    message: /tower 3 .* is not inside the arena/,
  },
])('$label is a violation', ({ broken, message }) => {
  const violations = checkInvariants(broken);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatch(message);
});
