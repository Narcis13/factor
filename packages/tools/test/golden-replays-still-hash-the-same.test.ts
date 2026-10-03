import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveReplay } from '@factor/content';
import { hashState } from '@factor/sim';
import { expect, test } from 'vitest';
import {
  botReplay,
  checkGoldens,
  GOLDEN_EVERY,
  GOLDEN_HASHES_FILE,
  goldenHashes,
  playReplay,
  readGoldenHashes,
  readGoldens,
  updateGoldens,
} from '../src/index.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const GOLDENS = fileURLToPath(new URL('../../../goldens', import.meta.url));

function sim(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

/** How many checkpoints a stored golden has, and its last tick: what `goldens` prints for it. */
function stored(name: string): { checkpoints: number; lastTick: number } {
  const ticks = Object.keys(readGoldenHashes(GOLDENS)[name] ?? {}).map(Number);
  return { checkpoints: ticks.length, lastTick: Math.max(...ticks) };
}

/**
 * Every golden's name. seed-0, seed-42 and seed-54 are always kept; the rest are chosen, when the
 * goldens are re-recorded, to cover the kinds of ending below.
 */
const NAMES = Object.keys(readGoldenHashes(GOLDENS));
/** A golden that isn't one of the three always kept, to remove from a copy. */
const SPARE = NAMES.find((name) => !['seed-0', 'seed-42', 'seed-54'].includes(name)) ?? 'none';

/** A bot-vs-bot seed that isn't a golden, to add to a copy. */
const EXTRA_SEED = [9, 10, 11, 12, 13, 14].find((seed) => !NAMES.includes(`seed-${String(seed)}`)) ?? 999;
const EXTRA = `seed-${String(EXTRA_SEED)}`;

/** A copy of the real goldens to tamper with. */
function copyGoldens(): string {
  const dir = mkdtempSync(join(tmpdir(), 'factor-goldens-'));
  for (const file of readdirSync(GOLDENS)) {
    copyFileSync(join(GOLDENS, file), join(dir, file));
  }
  return dir;
}

test('every golden replay still plays to its stored hashes', () => {
  const checks = checkGoldens(GOLDENS);
  expect(checks.map((check) => check.name)).toEqual(NAMES);
  expect(NAMES).toEqual(expect.arrayContaining(['seed-0', 'seed-42', 'seed-54']));
  expect(SPARE).not.toBe('none');
  for (const check of checks) {
    expect(check, check.name).toMatchObject({ problem: null });
  }
});

test('the goldens cover regulation wins for each side, an overtime star, a Keep kill and a draw', () => {
  const ends = readGoldens(GOLDENS).map(({ replay }) => playReplay(replay));
  const regulation = ends.filter((end) => end.tick === end.rules.regulationTicks);
  expect(regulation.map((end) => end.result?.winner)).toEqual(expect.arrayContaining([0, 1]));
  const overtime = ends.filter((end) => end.tick > end.rules.regulationTicks);
  expect(overtime.some((end) => end.result?.winner !== null && end.towers.every((tower) => tower.kind !== 'keep' || tower.hp > 0))).toBe(true);
  expect(ends.some((end) => end.towers.some((tower) => tower.kind === 'keep' && tower.hp === 0))).toBe(true);
  expect(ends.some((end) => end.result?.winner === null)).toBe(true);
});

test('hashes are stored every checkpoint and at the end, and the last is the match’s final hash', () => {
  const replay = botReplay(101);
  const hashes = goldenHashes(replay);
  const final = playReplay(replay);
  const ticks = Object.keys(hashes).map(Number);
  // The final tick is a checkpoint of its own unless it falls on one.
  const every = Array.from({ length: Math.floor(final.tick / GOLDEN_EVERY) }, (_, i) => (i + 1) * GOLDEN_EVERY);
  expect(ticks).toEqual(final.tick % GOLDEN_EVERY === 0 ? every : [...every, final.tick]);
  expect(hashes[String(final.tick)]).toBe(hashState(final));
  expect(hashes[String(GOLDEN_EVERY)]).toBe(hashState(playReplay(replay, GOLDEN_EVERY)));
  const end42 = playReplay(botReplay(42));
  expect(readGoldenHashes(GOLDENS)['seed-42']?.[String(end42.tick)]).toBe(hashState(end42));
});

test('a changed hash fails at its checkpoint and names the tick', () => {
  const dir = copyGoldens();
  const hashes = readGoldenHashes(dir);
  const seed42 = hashes['seed-42'] ?? {};
  seed42['1200'] = '00000000';
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  const failed = checkGoldens(dir).filter((check) => check.problem !== null);
  expect(failed).toEqual([
    { name: 'seed-42', ...stored('seed-42'), problem: `tick 1200: expected 00000000, got ${String(readGoldenHashes(GOLDENS)['seed-42']?.['1200'])}` },
  ]);

  // Checkpoints compare in tick order, not text order ("1200" < "400").
  seed42['400'] = '11111111';
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  expect(checkGoldens(dir).find((check) => check.name === 'seed-42')?.problem).toMatch(/^tick 400: expected 11111111, got /);
});

test('a match that now ends at another tick fails at the first checkpoint it misses', () => {
  const dir = copyGoldens();
  const hashes = readGoldenHashes(dir);
  const past = String(stored('seed-0').lastTick + GOLDEN_EVERY);
  hashes['seed-0'] = { ...hashes['seed-0'], [past]: 'abcdef01' };
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  expect(checkGoldens(dir).find((check) => check.name === 'seed-0')?.problem).toBe(`tick ${past}: expected abcdef01, got no checkpoint`);
});

test('a replay with no stored hashes, hashes with no replay, and a replay that no longer plays all fail', () => {
  const dir = copyGoldens();
  writeFileSync(join(dir, `${EXTRA}.json`), saveReplay(botReplay(EXTRA_SEED)));
  rmSync(join(dir, `${SPARE}.json`));
  const { lastTick } = stored('seed-42');
  const extra = { tick: lastTick + 100, side: 0 as const, handSlot: 0, x: 0, y: 0 };
  writeFileSync(join(dir, 'seed-42.json'), saveReplay({ ...botReplay(42), commands: [...botReplay(42).commands, extra] }));
  const problems = Object.fromEntries(checkGoldens(dir).map((check) => [check.name, check.problem]));
  expect(problems[EXTRA]).toBe('no stored hashes in hashes.json');
  expect(problems[SPARE]).toBe('stored hashes but no replay');
  expect(problems['seed-42']).toBe(`The match ended at tick ${String(lastTick)} with 1 commands unplayed`);
});

test('--update stores fresh hashes for every replay and drops hashes with no replay', () => {
  const dir = copyGoldens();
  writeFileSync(join(dir, `${EXTRA}.json`), saveReplay(botReplay(EXTRA_SEED)));
  rmSync(join(dir, `${SPARE}.json`));
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), '{}');
  expect(updateGoldens(dir).every((check) => check.problem === null)).toBe(true);
  const hashes = readGoldenHashes(dir);
  expect(Object.keys(hashes)).toEqual([...NAMES.filter((name) => name !== SPARE), EXTRA].sort());
  expect(hashes[EXTRA]).toEqual(goldenHashes(botReplay(EXTRA_SEED)));
  expect(hashes['seed-42']).toEqual(readGoldenHashes(GOLDENS)['seed-42']);
  expect(readFileSync(join(dir, GOLDEN_HASHES_FILE), 'utf8')).toBe(readFileSync(join(dir, GOLDEN_HASHES_FILE), 'utf8').trimEnd() + '\n');
});

test('goldens prints one line per golden and exits 0 when all match', () => {
  const { status, stdout } = sim('goldens', '--dir', GOLDENS);
  expect(status).toBe(0);
  const { checkpoints, lastTick } = stored('seed-42');
  // Names are padded to the longest one.
  expect(stdout).toMatch(new RegExp(`^seed-42 +ok +${String(checkpoints)} checkpoints to tick ${String(lastTick)}$`, 'm'));
  expect(stdout.trimEnd().split('\n')).toHaveLength(NAMES.length);
});

test('goldens exits 1 and names the tick when a golden changed; --update fixes it', () => {
  const dir = copyGoldens();
  const hashes = readGoldenHashes(dir);
  hashes['seed-54'] = { ...hashes['seed-54'], '200': 'ffffffff' };
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), JSON.stringify(hashes));
  const failed = sim('goldens', '--dir', dir);
  expect(failed.status).toBe(1);
  expect(failed.stdout).toMatch(/^seed-54 +FAIL {4}tick 200: expected ffffffff, got [0-9a-f]{8}$/m);
  const updated = sim('goldens', '--dir', dir, '--update');
  expect(updated.status).toBe(0);
  const { checkpoints, lastTick } = stored('seed-54');
  expect(updated.stdout).toMatch(new RegExp(`^seed-54 +stored +${String(checkpoints)} checkpoints to tick ${String(lastTick)}$`, 'm'));
  expect(readGoldenHashes(dir)).toEqual(readGoldenHashes(GOLDENS));
});

test('goldens on a directory with no goldens is bad input, not a crash', () => {
  const { status, stderr } = sim('goldens', '--dir', join(tmpdir(), 'factor-no-such-goldens'));
  expect(status).toBe(1);
  expect(stderr).toContain('no such file or directory');
});
