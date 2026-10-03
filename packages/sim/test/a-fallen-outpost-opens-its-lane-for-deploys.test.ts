import { expect, test } from 'vitest';
import { deployZones, step, type Command, type SimState } from '../src/index.ts';
import { walkMatch } from './fixtures.ts';

// The fixture arena: 10 × 20 tiles, the river at y 9000–11000. Side 1's left Outpost is tower 4
// (1000–3000 × 14000–16000) and its right one tower 5; side 0's are 1 and 2.
const START = walkMatch(5);

function fell(state: SimState, ...ids: number[]): SimState {
  return { ...state, towers: state.towers.map((tower) => (ids.includes(tower.id) ? { ...tower, hp: 0 } : tower)) };
}

function play(state: SimState, side: 0 | 1, x: number, y: number): Command {
  return { tick: state.tick, side, handSlot: 0, x, y };
}

test('a fallen enemy Outpost opens its lane’s side of the enemy half to the side that felled it', () => {
  const left = fell(START, 4);
  expect(deployZones(left, 0)).toEqual([
    { x: 0, y: 0, width: 10_000, height: 9000 },
    { x: 0, y: 11_000, width: 5000, height: 9000 },
  ]);
  // The opener's opponent gains nothing.
  expect(deployZones(left, 1)).toEqual(deployZones(START, 1));
  // Both Outposts down: the whole enemy half, left lane first.
  expect(deployZones(fell(START, 4, 5), 0).slice(1)).toEqual([
    { x: 0, y: 11_000, width: 5000, height: 9000 },
    { x: 5000, y: 11_000, width: 5000, height: 9000 },
  ]);
  // Side 1 felling side 0's right Outpost opens the right lane of side 0's half.
  expect(deployZones(fell(START, 2), 1).slice(1)).toEqual([{ x: 5000, y: 0, width: 5000, height: 9000 }]);
});

test('a troop deploys in the opened lane, still not on a standing tower or in the other lane', () => {
  const left = fell(START, 4);
  const cases: [number, number, string | null][] = [
    [2000, 12_000, null], // in front of the rubble, in the open lane
    [2000, 15_000, null], // on the rubble itself
    [4999, 19_000, null], // the open lane's far corner, beside the Keep
    [5000, 12_000, 'outside-deploy-zone'], // the right lane is still closed
    [4500, 18_000, 'occupied'], // the Keep (4000–6000 × 17000–19000) still stands, half of it in the open lane
    [2000, 10_000, 'outside-deploy-zone'], // the river is never open
  ];
  for (const [x, y, reason] of cases) {
    const command = play(left, 0, x, y);
    const after = step(left, [command]);
    expect(after.rejected).toEqual(reason === null ? [] : [{ command, reason }]);
  }
});
