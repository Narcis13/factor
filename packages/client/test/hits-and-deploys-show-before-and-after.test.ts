import { ARENA, CARDS, matchSetup } from '@factor/content';
import { createMatch, type SimState, type Unit } from '@factor/sim';
import { expect, test } from 'vitest';
import { unitScene } from '../src/arena-view.ts';
import { EFFECT_TICKS, effectScene, effectsBetween } from '../src/effects.ts';
import { ghostScene } from '../src/ghost.ts';
import { advance, createLoop, TICK_MS } from '../src/match-loop.ts';
import { layoutScreen } from '../src/screen-layout.ts';

// 540 × 960 puts the arena at 24 px a tile, its top-left corner at (54, 0).
const PHONE = layoutScreen(ARENA, 4, 540, 960);
const DECK = ['rabble', 'flare', 'bastion', 'warden', 'slinger', 'harrier', 'bombardier', 'juggernaut'];
const START = createMatch(matchSetup(3, [DECK, DECK]));

function unitAt(card: string, side: 0 | 1, x: number, y: number, id: number, hp?: number): Unit {
  const stats = START.cards[card];
  const full = stats === undefined || stats.type === 'spell' ? 1 : stats.unit.hp;
  return { id, side, card, x, y, hp: hp ?? full, maxHp: full, deployTicks: 0, age: 0, targetId: null, cooldown: 0 };
}

test('a hit flashes, on a unit or a tower, and a death leaves a puff', () => {
  const before: SimState = { ...START, tick: 50, units: [unitAt('warden', 1, 9000, 21_000, 20), unitAt('rabble', 1, 10_000, 21_000, 21)] };
  const towers = START.towers.map((tower) => (tower.id === 4 ? { ...tower, hp: tower.hp - 90 } : tower));
  const after: SimState = { ...before, tick: 51, towers, units: [unitAt('warden', 1, 9000, 21_000, 20, 1040)] };
  expect(effectsBetween(before, after)).toEqual([
    { kind: 'flash', tick: 51, id: 4, side: 1, x: 3500, y: 25_500, radius: 1500, card: 'outpost' },
    { kind: 'flash', tick: 51, id: 20, side: 1, x: 9000, y: 21_000, radius: CARDS.warden.unit.radius, card: 'warden' },
    { kind: 'death', tick: 51, id: 21, side: 1, x: 10_000, y: 21_000, radius: CARDS.rabble.unit.radius, card: 'rabble' },
  ]);
  expect(effectsBetween(after, after)).toEqual([]);
});

test('effects fade out over 0.3 s; a flash stays on its unit, a tower’s covers its square', () => {
  const before: SimState = { ...START, tick: 10, units: [unitAt('warden', 1, 9000, 21_000, 20)] };
  const after: SimState = { ...before, tick: 11, towers: START.towers.map((tower) => (tower.id === 0 ? { ...tower, hp: tower.hp - 1 } : tower)), units: [unitAt('warden', 1, 9000, 21_000, 20, 1100)] };
  const effects = effectsBetween(before, after);
  const units = unitScene(after, after, 0, PHONE.view);
  const now = effectScene(effects, after, 0, PHONE.view, units);
  expect(now.map((shape) => [shape.kind, shape.square, shape.fade])).toEqual([
    ['flash', true, 1],
    ['flash', false, 1],
  ]);
  expect(now[1]).toMatchObject({ x: units[0]?.x, y: units[0]?.y });
  expect(EFFECT_TICKS).toBe(6);
  expect(effectScene(effects, { ...after, tick: after.tick + 3 }, 0, PHONE.view, units)[0]?.fade).toBeCloseTo(0.5);
  expect(effectScene(effects, { ...after, tick: after.tick + EFFECT_TICKS }, 0, PHONE.view, units)).toEqual([]);
});

test('the live loop keeps the effects of the last 0.3 s', () => {
  const placed: SimState = { ...START, units: [unitAt('rabble', 1, 3500, 9000, START.nextId)], nextId: START.nextId + 1 };
  const loop = createLoop(placed);
  let seen = 0;
  for (let i = 0; i < 200; i++) {
    advance(loop, TICK_MS);
    seen += loop.effects.length;
    expect(loop.effects.every((effect) => loop.current.tick - effect.tick < EFFECT_TICKS)).toBe(true);
  }
  // The Outpost shoots the rabble down: flashes, and a puff.
  expect(seen).toBeGreaterThan(0);
});

test('the ghost shows where the selected card would land, and what the sim would say', () => {
  const rich: SimState = { ...START, players: [{ ...START.players[0], hand: ['rabble', 'flare', 'bastion', 'warden'], energy: 10 }, START.players[1]] };
  // Screen (270, 600) is arena (9000, ≈7000): side 0's own half, clear of towers.
  const ownHalf = { x: 54 + 9 * 24, y: 600 };
  const enemyHalf = { x: 54 + 9 * 24, y: 200 };
  const group = ghostScene(rich, 0, 0, ownHalf, PHONE);
  expect(group).toHaveLength(CARDS.rabble.unit.count);
  expect(group.every((ghost) => ghost.shape === 'circle' && ghost.status === 'ok')).toBe(true);
  const refused = ghostScene(rich, 0, 0, enemyHalf, PHONE);
  expect(refused).toHaveLength(CARDS.rabble.unit.count);
  expect(refused.every((ghost) => ghost.status === 'refused')).toBe(true);
  const spell = ghostScene(rich, 0, 1, enemyHalf, PHONE);
  expect(spell).toEqual([expect.objectContaining({ shape: 'circle', status: 'ok' })]);
  expect(spell[0]?.radius).toBeCloseTo((CARDS.flare.spell.radius * 24) / 1000);
  expect(ghostScene(rich, 0, 2, ownHalf, PHONE)).toEqual([expect.objectContaining({ shape: 'square', status: 'ok' })]);
  const poor: SimState = { ...rich, players: [{ ...rich.players[0], energy: 1 }, rich.players[1]] };
  expect(ghostScene(poor, 0, 3, ownHalf, PHONE)[0]?.status).toBe('energy');
  expect(ghostScene(rich, 0, null, ownHalf, PHONE)).toEqual([]);
  expect(ghostScene(rich, 0, 0, null, PHONE)).toEqual([]);
  expect(ghostScene(rich, 0, 0, { x: 10, y: 10 }, PHONE)).toEqual([]);
});
