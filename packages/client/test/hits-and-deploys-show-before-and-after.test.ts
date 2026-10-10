import { CARDS, matchSetup } from '@factor/content';
import { createMatch, type SimState, type Unit } from '@factor/sim';
import { expect, test } from 'vitest';
import { EFFECT_LIFE, EFFECT_TICKS, effectsBetween } from '../src/effects.ts';
import { ghostPlan } from '../src/ghost.ts';
import { advance, createLoop, TICK_MS } from '../src/match-loop.ts';

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

test('arrivals raise dust, a fallen tower blows up, and a shot remembers who fired it from where', () => {
  const outpost = START.towers.find((tower) => tower.id === 4);
  const slinger = unitAt('slinger', 0, 4000, 9000, 20);
  const before: SimState = { ...START, tick: 80, units: [slinger] };
  const shots = [
    { id: 30, side: 1 as const, x: outpost?.x ?? 0, y: outpost?.y ?? 0, targetId: 20, toX: 4000, toY: 9000, speed: 800, damage: 90, splash: 0, targets: 'air' as const },
    { id: 31, side: 0 as const, x: 4000, y: 9000, targetId: 4, toX: 3500, toY: 25_500, speed: 500, damage: 90, splash: 0, targets: 'air' as const },
  ];
  const towers = START.towers.map((tower) => (tower.id === 1 ? { ...tower, hp: 0 } : tower));
  const arrived = { ...unitAt('warden', 0, 9000, 6000, 32), deployTicks: 20 };
  const after: SimState = { ...before, tick: 81, towers, units: [slinger, arrived], projectiles: shots };
  expect(effectsBetween(before, after).map(({ kind, id, card }) => ({ kind, id, card }))).toEqual([
    { kind: 'flash', id: 1, card: 'outpost' },
    { kind: 'deploy', id: 32, card: 'warden' },
    { kind: 'fall', id: 1, card: 'outpost' },
    { kind: 'shot', id: 30, card: 'outpost' },
    { kind: 'shot', id: 31, card: 'slinger' },
  ]);
});

test('each kind of effect lasts its own time: a flash 0.3 s, longer for the animations', () => {
  expect(EFFECT_TICKS).toBe(6);
  expect(EFFECT_LIFE.flash).toBe(EFFECT_TICKS);
  for (const kind of ['death', 'deploy', 'fall', 'shot'] as const) {
    expect(EFFECT_LIFE[kind]).toBeGreaterThan(EFFECT_TICKS);
  }
});

test('the live loop keeps each effect for its life', () => {
  const placed: SimState = { ...START, units: [unitAt('rabble', 1, 3500, 9000, START.nextId)], nextId: START.nextId + 1 };
  const loop = createLoop(placed);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    advance(loop, TICK_MS);
    for (const effect of loop.effects) {
      seen.add(effect.kind);
    }
    expect(loop.effects.every((effect) => loop.current.tick - effect.tick < EFFECT_LIFE[effect.kind])).toBe(true);
  }
  // The Outpost shoots the rabble down: shots, flashes, and a puff.
  expect([...seen].sort()).toEqual(['death', 'flash', 'shot']);
});

test('the ghost plans where the selected card would land, and what the sim would say', () => {
  const rich: SimState = { ...START, players: [{ ...START.players[0], hand: ['rabble', 'flare', 'bastion', 'warden'], energy: 10 }, START.players[1]] };
  // Side 0's own half, clear of towers, and the enemy's.
  const ownHalf = { x: 9000, y: 7000 };
  const enemyHalf = { x: 9000, y: 25_000 };
  const group = ghostPlan(rich, 0, 0, ownHalf);
  expect(group?.spots).toHaveLength(CARDS.rabble.unit.count);
  expect(group).toMatchObject({ card: 'rabble', side: 0, status: 'ok' });
  expect(ghostPlan(rich, 0, 0, enemyHalf)?.status).toBe('refused');
  expect(ghostPlan(rich, 0, 1, enemyHalf)).toMatchObject({ card: 'flare', status: 'ok', spots: [enemyHalf] });
  expect(ghostPlan(rich, 0, 2, ownHalf)).toMatchObject({ card: 'bastion', status: 'ok', spots: [ownHalf] });
  const poor: SimState = { ...rich, players: [{ ...rich.players[0], energy: 1 }, rich.players[1]] };
  expect(ghostPlan(poor, 0, 3, ownHalf)?.status).toBe('energy');
  expect(ghostPlan(rich, 0, null, ownHalf)).toBeNull();
  expect(ghostPlan(rich, 0, 0, null)).toBeNull();
});
