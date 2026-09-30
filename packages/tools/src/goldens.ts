import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadReplay, type Replay } from '@factor/content';
import { hashState } from '@factor/sim';
import { playReplay } from './match.ts';

/** Ticks between stored hashes. The final tick is always stored too. */
export const GOLDEN_EVERY = 200;

/** The file in the goldens directory that holds every golden's hashes; each other `.json` file is a golden replay. */
export const GOLDEN_HASHES_FILE = 'hashes.json';

/** State hashes by tick (as a decimal string), ascending. */
export type GoldenHashes = Record<string, string>;

/** A golden replay, named after its file. */
export interface Golden {
  name: string;
  replay: Replay;
}

/** One golden's check: `problem` is `null` when it still plays to the stored hashes. */
export interface GoldenCheck {
  name: string;
  /** The checkpoints stored for it, and the last one's tick (0 when none are stored). */
  checkpoints: number;
  lastTick: number;
  problem: string | null;
}

/**
 * Plays a replay with invariants checked every tick and hashes the state every `GOLDEN_EVERY` ticks
 * and at the tick the match ends (VISION §6 golden replays).
 */
export function goldenHashes(replay: Replay): GoldenHashes {
  const hashes: GoldenHashes = {};
  const final = playReplay(replay, undefined, (state) => {
    if (state.tick % GOLDEN_EVERY === 0) {
      hashes[String(state.tick)] = hashState(state);
    }
  });
  hashes[String(final.tick)] = hashState(final);
  return hashes;
}

/** The golden replays in `dir`, by name (the file name without `.json`), in name order. */
export function readGoldens(dir: string): Golden[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json') && file !== GOLDEN_HASHES_FILE)
    .sort()
    .map((file) => {
      const name = basename(file, '.json');
      try {
        return { name, replay: loadReplay(readFileSync(join(dir, file), 'utf8')) };
      } catch (error) {
        throw new Error(`${join(dir, file)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    });
}

/** The stored hashes in `dir`, by golden name. */
export function readGoldenHashes(dir: string): Record<string, GoldenHashes> {
  return JSON.parse(readFileSync(join(dir, GOLDEN_HASHES_FILE), 'utf8')) as Record<string, GoldenHashes>;
}

/**
 * Plays every golden replay in `dir` and compares its hashes with the stored ones. A golden fails at
 * the first checkpoint that differs, or if it no longer plays. Stored hashes with no replay fail too.
 */
export function checkGoldens(dir: string): GoldenCheck[] {
  const stored = readGoldenHashes(dir);
  const goldens = readGoldens(dir);
  const checks = goldens.map(({ name, replay }): GoldenCheck => {
    const expected = stored[name];
    const ticks = Object.keys(expected ?? {});
    const summary = { name, checkpoints: ticks.length, lastTick: Number(ticks.at(-1) ?? 0) };
    if (expected === undefined) {
      return { ...summary, problem: `no stored hashes in ${GOLDEN_HASHES_FILE}` };
    }
    let actual: GoldenHashes;
    try {
      actual = goldenHashes(replay);
    } catch (error) {
      return { ...summary, problem: error instanceof Error ? error.message : String(error) };
    }
    return { ...summary, problem: firstDifference(expected, actual) };
  });
  const named = new Set(goldens.map((golden) => golden.name));
  for (const name of Object.keys(stored).filter((stale) => !named.has(stale))) {
    const ticks = Object.keys(stored[name] ?? {});
    checks.push({ name, checkpoints: ticks.length, lastTick: Number(ticks.at(-1) ?? 0), problem: 'stored hashes but no replay' });
  }
  return checks;
}

/** Replays every golden in `dir` and stores its hashes afresh, dropping hashes with no replay. Returns the new checks. */
export function updateGoldens(dir: string): GoldenCheck[] {
  const hashes: Record<string, GoldenHashes> = {};
  for (const { name, replay } of readGoldens(dir)) {
    hashes[name] = goldenHashes(replay);
  }
  writeFileSync(join(dir, GOLDEN_HASHES_FILE), `${JSON.stringify(hashes, null, 2)}\n`);
  return checkGoldens(dir);
}

function firstDifference(expected: GoldenHashes, actual: GoldenHashes): string | null {
  const ticks = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].map(Number).sort((a, b) => a - b);
  for (const tick of ticks) {
    const [want, got] = [expected[String(tick)], actual[String(tick)]];
    if (want !== got) {
      return `tick ${String(tick)}: expected ${want ?? 'no checkpoint'}, got ${got ?? 'no checkpoint'}`;
    }
  }
  return null;
}
