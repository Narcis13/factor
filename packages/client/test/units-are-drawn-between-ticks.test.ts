import { ARENA, matchSetup } from '@factor/content';
import { createMatch, step, type Command, type SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { fitView, noDeployRect, unitScene } from '../src/index.ts';
import { stepTo } from '../src/match-loop.ts';

// 540 × 960 fits the arena at 30 px per tile, so 1 tile = 30 px and the arena's top edge is y = 0.
const VIEW = fitView(ARENA, 540, 960);
const START = createMatch(matchSetup(4));

/** Side 0 plays the first troop in its hand at (3500, 8000), then the match runs `ticks` more. */
function withTroop(ticks: number): { state: SimState; card: string } {
  const full = stepTo(START, 200);
  const slot = full.players[0].hand.findIndex((card) => full.cards[card]?.type === 'troop');
  const card = full.players[0].hand[slot] ?? '';
  const command: Command = { tick: full.tick, side: 0, handSlot: slot, x: 3500, y: 10_000 };
  let state = step(full, [command]);
  expect(state.rejected).toEqual([]);
  for (let i = 0; i < ticks; i++) {
    state = step(state, []);
  }
  return { state, card };
}

test('a unit is drawn at its position, as a circle of its radius, faint while it deploys', () => {
  const { state, card } = withTroop(0);
  const stats = state.cards[card];
  const radius = stats?.type === 'troop' ? stats.unit.radius : 0;
  const hp = stats?.type === 'troop' ? stats.unit.hp : 0;
  expect(unitScene(state, state, 0, VIEW)).toEqual([
    { id: 6, side: 0, card, x: 3.5 * 30, y: (32 - 10) * 30, radius: (radius * 30) / 1000, deploying: true, flying: false, building: false, hp, maxHp: hp },
  ]);
  const later = stepTo(state, state.tick + 40);
  expect(unitScene(later, later, 0, VIEW)[0]?.deploying).toBe(false);
});

test('between two ticks a unit is drawn alpha of the way from where it was to where it is', () => {
  const { state: previous } = withTroop(30);
  const current = step(previous, []);
  const [from, to] = [previous.units[0], current.units[0]];
  expect(from && to && to.y).toBeGreaterThan(from?.y ?? 0);
  const at = (alpha: number) => unitScene(previous, current, alpha, VIEW)[0];
  expect(at(0)?.y).toBeCloseTo(unitScene(previous, previous, 0, VIEW)[0]?.y ?? NaN);
  expect(at(1)?.y).toBeCloseTo(unitScene(current, current, 0, VIEW)[0]?.y ?? NaN);
  expect(at(0.5)?.y).toBeCloseTo(((at(0)?.y ?? 0) + (at(1)?.y ?? 0)) / 2);
});

test('a unit that is new this tick is drawn where it stands', () => {
  const { state } = withTroop(0);
  const before = { ...state, units: [] };
  expect(unitScene(before, state, 0.3, VIEW)).toEqual(unitScene(state, state, 0, VIEW));
});

test('the shade for a selected troop covers everything but the side’s own half', () => {
  expect(noDeployRect(ARENA, 0)).toEqual({ x: 0, y: ARENA.river.y, width: ARENA.width, height: ARENA.height - ARENA.river.y });
  expect(noDeployRect(ARENA, 1)).toEqual({ x: 0, y: 0, width: ARENA.width, height: ARENA.river.y + ARENA.river.height });
});
