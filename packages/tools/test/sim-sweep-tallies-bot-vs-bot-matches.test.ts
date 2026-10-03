import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CARD_IDS } from '@factor/content';
import type { CardId, SimState } from '@factor/sim';
import { expect, test } from 'vitest';
import { botReplay, describeSweep, playReplay, sweep } from '../src/index.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

function sim(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

const FROM = 40;
const MATCHES = 6;
const report = sweep(FROM, MATCHES);
const finals = Array.from({ length: MATCHES }, (_, index) => playReplay(botReplay(FROM + index)));

test('a sweep over healthy seeds finds no violations or mismatches', () => {
  expect(report.violations).toEqual([]);
  expect(report.mismatches).toEqual([]);
});

test('results, length and stars add up to the same matches played one by one', () => {
  const wins = [0, 1].map((side) => finals.filter((state) => state.result?.winner === side).length);
  expect(report.wins).toEqual(wins);
  expect(report.draws).toBe(finals.filter((state) => state.result?.winner === null).length);
  expect(report.wins[0] + report.wins[1] + report.draws).toBe(MATCHES);
  const ticks = finals.map((state) => state.tick);
  expect(report.totalTicks).toBe(ticks.reduce((sum, tick) => sum + tick, 0));
  expect(report.shortest).toBe(Math.min(...ticks));
  expect(report.longest).toBe(Math.max(...ticks));
  expect(report.overtime).toBe(finals.filter((state) => state.tick > state.rules.regulationTicks).length);
  expect(report.stars).toEqual([0, 1].map((side) => finals.reduce((sum, state) => sum + (state.stars[side] ?? 0), 0)));
});

test('tower damage counts the hp each side took off the other side’s towers', () => {
  const taken = (state: SimState, owner: number) =>
    state.towers.filter((tower) => tower.side === owner).reduce((sum, tower) => sum + tower.maxHp - tower.hp, 0);
  expect(report.towerDamage).toEqual([
    finals.reduce((sum, state) => sum + taken(state, 1), 0),
    finals.reduce((sum, state) => sum + taken(state, 0), 0),
  ]);
  expect(report.towerDamage[0] + report.towerDamage[1]).toBeGreaterThan(0);
});

test('plays per card match the troops that deployed and the spells that landed', () => {
  const landed: Record<CardId, number> = {};
  const count = (card: CardId) => (landed[card] = (landed[card] ?? 0) + 1);
  for (let index = 0; index < MATCHES; index++) {
    let lastId = -1;
    playReplay(botReplay(FROM + index), undefined, (state) => {
      // A bot plays at most once a tick, and a swarm's units all appear together: one play per side and card.
      const fresh = state.units.filter((unit) => unit.id > lastId);
      new Set(fresh.map((unit) => `${String(unit.side)} ${unit.card}`)).forEach((play) => count(play.slice(2)));
      lastId = Math.max(lastId, state.nextId - 1);
      state.blasts.forEach((blast) => count(blast.card));
    });
  }
  expect(report.plays).toEqual(landed);
  expect(Object.keys(report.plays).sort()).toEqual([...CARD_IDS].sort());
});

test('the sweep is deterministic', () => {
  expect(sweep(FROM, MATCHES)).toEqual(report);
});

test('the report prints one fact per line, with the seed range', () => {
  const text = describeSweep(report);
  expect(text).toContain(`seeds       40..45 (6 matches, 6 healthy)`);
  expect(text).toMatch(/^results {5}side 0 \d+ · side 1 \d+ · draw \d+$/m);
  const plays = [...CARD_IDS].sort().map((id) => `${id} \\d+`).join(' · ');
  expect(text).toMatch(new RegExp(`^plays {7}${plays}$`, 'm'));
  expect(text).toContain('violations  0\nmismatches  0');
});

test('sweep prints its report and exits 0 when every match is healthy', () => {
  const { status, stdout } = sim('sweep', '--matches', '3', '--from', '40');
  expect(status).toBe(0);
  expect(stdout).toContain('seeds       40..42 (3 matches, 3 healthy)');
  expect(stdout).toContain(describeSweep(sweep(40, 3)));
  expect(stdout).toMatch(/^took {8}\d+ s$/m);
});

test.each([[], ['--matches', '0'], ['--matches', 'x'], ['--matches', '2', '--from', '4294967295'], ['--matches', '1', '--wat']])(
  'sweep %j is a usage error',
  (...args) => {
    const { status, stderr } = sim('sweep', ...args);
    expect(status).toBe(1);
    expect(stderr).toContain('Usage: pnpm sim');
  },
);
