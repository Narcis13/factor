import { expect, test } from 'vitest';
import { step, type Command, type Side, type SimState } from '../src/index.ts';
import { CARDS, idle, newMatch, RULES } from './fixtures.ts';

/** Sets one side's energy, as a scenario setup. */
function withEnergy(state: SimState, side: Side, energy: number, energyProgress = 0): SimState {
  const players: SimState['players'] = [{ ...state.players[0] }, { ...state.players[1] }];
  players[side] = { ...players[side], energy, energyProgress };
  return { ...state, players };
}

/** Ticks until `side` gains one energy, starting from `state`. */
function ticksToNextEnergy(state: SimState, side: Side): number {
  const start = state.players[side].energy;
  let current = state;
  let ticks = 0;
  while (current.players[side].energy === start) {
    current = step(current, []);
    ticks++;
  }
  return ticks;
}

test('both sides start with 5 energy and nothing toward the next', () => {
  const { players } = newMatch(1);
  expect(players.map((p) => [p.energy, p.energyProgress])).toEqual([
    [5, 0],
    [5, 0],
  ]);
});

test('one energy regenerates every 56 ticks (2.8 s) in regulation', () => {
  const start = newMatch(1);
  expect(idle(start, 55).players[0]).toMatchObject({ energy: 5, energyProgress: 55 });
  expect(idle(start, 56).players[0]).toMatchObject({ energy: 6, energyProgress: 0 });
  expect(idle(start, 56 * 3).players.map((p) => p.energy)).toEqual([8, 8]);
});

test('energy stops at 10 and nothing builds up while it is full', () => {
  const full = idle(newMatch(1), 56 * 5);
  expect(full.players[0]).toMatchObject({ energy: 10, energyProgress: 0 });
  const later = idle(full, 500);
  expect(later.players[0]).toMatchObject({ energy: 10, energyProgress: 0 });
  // Spending from full starts the next energy from nothing, on the same tick.
  const cost = CARDS[later.players[0].hand[0] ?? '']?.cost ?? 0;
  const play: Command = { tick: later.tick, side: 0, handSlot: 0, x: 5000, y: 4000 };
  const spent = step(later, [play]);
  expect(cost).toBeGreaterThan(0);
  expect(spent.players[0]).toMatchObject({ energy: 10 - cost, energyProgress: 1 });
});

test('regeneration doubles for the final 60 s of regulation: 28 ticks per energy', () => {
  // The step out of tick 2399 still adds 1; from tick 2400 on each adds 2, so 1 + 28 × 2 ≥ 56.
  const lastSlow = withEnergy(idle(newMatch(1), 2399), 0, 3);
  expect(ticksToNextEnergy(lastSlow, 0)).toBe(1 + 28);
  const fast = withEnergy(idle(newMatch(1), 2400), 0, 3);
  expect(ticksToNextEnergy(fast, 0)).toBe(28);
});

test('at double rate, progress past the next energy carries over, unless that energy fills the bar', () => {
  const fast = idle(newMatch(1), 2400);
  expect(step(withEnergy(fast, 0, 3, 55), []).players[0]).toMatchObject({ energy: 4, energyProgress: 1 });
  expect(step(withEnergy(fast, 0, 9, 55), []).players[0]).toMatchObject({ energy: 10, energyProgress: 0 });
});

test('regeneration stays doubled in overtime', () => {
  const overtime = withEnergy(idle(newMatch(1), RULES.regulationTicks + 100), 1, 0);
  expect(ticksToNextEnergy(overtime, 1)).toBe(28);
});
