import { expect, test } from 'vitest';
import { createMatch, hashState, step, type TowerSite } from '../src/index.ts';
import { ARENA, idle, newMatch, RULES, TOWER_STATS } from './fixtures.ts';

test('a new match has one tower per site, ids in layout order, at full hp for its kind', () => {
  const { towers } = newMatch(1);
  expect(towers.map((tower) => tower.id)).toEqual([0, 1, 2, 3, 4, 5]);
  towers.forEach((tower, i) => {
    const site = ARENA.towers[i];
    expect(tower).toEqual({ ...site, id: i, hp: TOWER_STATS[tower.kind].hp, maxHp: TOWER_STATS[tower.kind].hp });
  });
  expect(towers.filter((tower) => tower.kind === 'keep').map((tower) => tower.hp)).toEqual([300, 300]);
  expect(towers.filter((tower) => tower.kind === 'outpost').map((tower) => tower.hp)).toEqual([200, 200, 200, 200]);
});

test('the state carries the terrain but not the tower sites', () => {
  const { arena } = newMatch(1);
  expect(arena).toEqual({ width: ARENA.width, height: ARENA.height, river: ARENA.river, bridges: ARENA.bridges });
});

test('with nothing to hit them, towers keep full hp to the end of the match', () => {
  const start = newMatch(1);
  const end = idle(start, RULES.regulationTicks + RULES.overtimeTicks);
  expect(end.result).not.toBeNull();
  expect(end.towers).toEqual(start.towers);
  expect(end.arena).toEqual(start.arena);
});

test('the state shares nothing with the setup, and nothing extra leaks in', () => {
  const site: TowerSite & { note?: string } = { ...ARENA.towers[0], note: 'not sim data' } as TowerSite;
  const arena = { ...ARENA, towers: [site] };
  const state = createMatch({ seed: 1, rules: RULES, arena, towerStats: TOWER_STATS });
  expect(state.towers[0]).not.toHaveProperty('note');
  expect(state.arena).not.toHaveProperty('towers');
  expect(state.arena.river).not.toBe(ARENA.river);
  expect(state.arena.bridges[0]).not.toBe(ARENA.bridges[0]);
});

test('each step has its own towers and terrain', () => {
  const state = newMatch(1);
  const next = step(state, []);
  expect(next.towers[0]).not.toBe(state.towers[0]);
  expect(next.arena.bridges[0]).not.toBe(state.arena.bridges[0]);
});

test('tower stats and layout are part of the hash', () => {
  const base = newMatch(1);
  const tougher = createMatch({
    seed: 1,
    rules: RULES,
    arena: ARENA,
    towerStats: { ...TOWER_STATS, keep: { hp: 301 } },
  });
  const moved = createMatch({
    seed: 1,
    rules: RULES,
    arena: { ...ARENA, towers: ARENA.towers.map((site, i) => (i === 0 ? { ...site, x: site.x + 1 } : site)) },
    towerStats: TOWER_STATS,
  });
  expect(hashState(tougher)).not.toBe(hashState(base));
  expect(hashState(moved)).not.toBe(hashState(base));
});

test.each([0, -1, 3 / 2, Number.NaN])('tower hp %s is rejected', (hp) => {
  const towerStats = { ...TOWER_STATS, outpost: { hp } };
  expect(() => createMatch({ seed: 1, rules: RULES, arena: ARENA, towerStats })).toThrow(RangeError);
});
