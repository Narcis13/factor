import { expect, test } from 'vitest';
import { checkInvariants, step, type Command, type SimState } from '../src/index.ts';
import { CARDS, DECK, idle, newMatch } from './fixtures.ts';

function play(state: SimState, handSlot: number, side: 0 | 1 = 0): Command {
  return { tick: state.tick, side, handSlot, x: 5000, y: side === 0 ? 4000 : 16_000 };
}

function cost(id: string | undefined): number {
  const stats = id === undefined ? undefined : CARDS[id];
  if (stats === undefined) {
    throw new Error(`no card ${String(id)}`);
  }
  return stats.cost;
}

/** Seed 1234 deals side 0 [c6, c2, c7, c1] with c4 next, then c8, c3, c5. */
const START = newMatch(1234);

test('the fixture seed deals the hand these scenarios assume', () => {
  expect(START.players[0].hand).toEqual(['c6', 'c2', 'c7', 'c1']);
  expect(START.players[0].queue).toEqual(['c4', 'c8', 'c3', 'c5']);
});

test('a played card spends its cost, goes to the back of the queue, and the next card takes its slot', () => {
  const after = step(START, [play(START, 1)]);
  expect(after.rejected).toEqual([]);
  expect(after.players[0]).toEqual({
    energy: 5 - 2,
    energyProgress: 1,
    hand: ['c6', 'c4', 'c7', 'c1'],
    queue: ['c8', 'c3', 'c5', 'c2'],
  });
  expect(after.players[1]).toEqual(step(START, []).players[1]);
});

test('playing a card that costs exactly the energy left leaves 0', () => {
  const six = idle(START, 56);
  expect(six.players[0].energy).toBe(6);
  const after = step(six, [play(six, 0)]);
  expect(after.rejected).toEqual([]);
  expect(after.players[0]).toMatchObject({ energy: 0, energyProgress: 1 });
});

test('a card costing more than the energy left is rejected and changes nothing', () => {
  const command = play(START, 0);
  const after = step(START, [command]);
  expect(after.rejected).toEqual([{ command, reason: 'not-enough-energy' }]);
  expect(after.players).toEqual(step(START, []).players);
});

test('commands in one tick see the energy and hand the earlier ones left', () => {
  // c2 (5 → 3), then slot 1 again now holds c4, which costs more than the 3 left.
  const [first, second] = [play(START, 1), play(START, 1)];
  const after = step(START, [first, second]);
  expect(after.rejected).toEqual([{ command: second, reason: 'not-enough-energy' }]);
  expect(after.players[0].hand[1]).toBe('c4');
});

test('each side spends only its own energy and cycles only its own deck', () => {
  const red = START.players[1];
  const after = step(START, [play(START, 1, 1)]);
  expect(after.players[0]).toEqual(step(START, []).players[0]);
  expect(after.players[1].energy).toBe(5 - cost(red.hand[1]));
  expect(after.players[1].queue.at(-1)).toBe(red.hand[1]);
});

test('playing slot 0 over and over cycles it with the queue: 5 cards in turn, the others kept', () => {
  let state = START;
  const played: string[] = [];
  for (let i = 0; i < DECK.length * 2; i++) {
    while (state.players[0].energy < cost(state.players[0].hand[0])) {
      state = step(state, []);
    }
    played.push(state.players[0].hand[0] ?? '');
    state = step(state, [play(state, 0)]);
    expect(state.rejected).toEqual([]);
    expect(checkInvariants(state)).toEqual([]);
  }
  // Slot 0 plays c6, then the queue in order, and round again; slots 1-3 never move.
  const lap = ['c6', 'c4', 'c8', 'c3', 'c5'];
  expect(played).toEqual(played.map((_, i) => lap[i % lap.length]));
  expect(state.players[0].hand.slice(1)).toEqual(['c2', 'c7', 'c1']);
  expect([...state.players[0].hand, ...state.players[0].queue].sort()).toEqual([...DECK].sort());
});
