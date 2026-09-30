import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadReplay, saveReplay, type Replay } from '@factor/content';
import { TICKS_PER_SECOND } from '@factor/sim';
import { botReplay, describeResult, playReplay } from './match.ts';

const USAGE = `factor sim (${String(TICKS_PER_SECOND)} ticks/s)

Usage: pnpm sim <command>

Commands:
  match --seed <n> [--dump <tick>] [--replay <file>]
      Play a match headless with a random bot on each side (the seed decides it all), replay it
      with invariants checked every tick, print the result, and save the replay to <file>
      (default: replays/seed-<n>.json).
      With --dump, print the full state at <tick> as JSON instead (and save nothing).

  replay <file> [--dump <tick>]
      Validate a replay file, play it back with invariants checked every tick, and print the result.
      With --dump, print the full state at <tick> as JSON instead.

  shots [--out <dir>]
      Open the client frozen at tick 90 in headless Chromium and save it as <dir>/arena.png (default dir: shots).
      Also runs as pnpm shots.`;

const UINT32_MAX = 0xffffffff;

/** Bad input, such as an invalid replay file: print the message, not a stack trace. */
class InputError extends Error {}

/** A mistake in how the CLI was called: print the message and usage. */
class UsageError extends InputError {}

function match(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: { seed: { type: 'string' }, dump: { type: 'string' }, replay: { type: 'string' } },
  });
  if (values.seed === undefined) {
    throw new UsageError('match needs --seed <n>');
  }
  const replay = botReplay(parseInteger('--seed', values.seed, UINT32_MAX));
  if (values.dump !== undefined) {
    dump(replay, values.dump);
    return;
  }
  const state = playReplay(replay);
  const file = values.replay ?? join('replays', `seed-${String(replay.seed)}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, saveReplay(replay));
  console.log(`${describeResult(replay.seed, state)}\nreplay  ${file}`);
}

function replay(args: string[]): void {
  const { values, positionals } = parseArgs({ args, options: { dump: { type: 'string' } }, allowPositionals: true });
  const [file, ...extra] = positionals;
  if (file === undefined || extra.length > 0) {
    throw new UsageError('replay needs exactly one <file>');
  }
  let loaded: Replay;
  try {
    loaded = loadReplay(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new InputError(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (values.dump !== undefined) {
    dump(loaded, values.dump);
    return;
  }
  console.log(describeResult(loaded.seed, playReplay(loaded)));
}

/** Prints the full state at the tick given by `--dump`. */
function dump(replay: Replay, tickText: string): void {
  const dumpTick = parseInteger('--dump', tickText, Number.MAX_SAFE_INTEGER);
  const state = playReplay(replay, dumpTick);
  if (state.tick !== dumpTick) {
    throw new InputError(`The match ended at tick ${String(state.tick)}, before tick ${String(dumpTick)}`);
  }
  console.log(JSON.stringify(state, null, 2));
}

async function shots(args: string[]): Promise<void> {
  const { values } = parseArgs({ args, options: { out: { type: 'string', default: 'shots' } } });
  // Loaded here so the other commands don't pay for starting Vite and Playwright.
  const { SHOT_VIEWPORT, shootArena } = await import('./shots.ts');
  const shot = await shootArena();
  await mkdir(values.out, { recursive: true });
  const file = join(values.out, 'arena.png');
  await writeFile(file, shot.png);
  const sha = createHash('sha256').update(shot.png).digest('hex').slice(0, 12);
  const size = `${String(SHOT_VIEWPORT.width)}×${String(SHOT_VIEWPORT.height)}`;
  console.log(`saved ${file}  ${size}  ${shot.renderer}  sha256 ${sha}`);
}

function parseInteger(flag: string, text: string, max: number): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || value > max) {
    throw new UsageError(`${flag} must be an integer from 0 to ${String(max)}, got ${text}`);
  }
  return value;
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === undefined || command === 'help') {
    console.log(USAGE);
  } else if (command === 'match') {
    match(args);
  } else if (command === 'replay') {
    replay(args);
  } else if (command === 'shots') {
    await shots(args);
  } else {
    throw new UsageError(`Unknown command: ${command}`);
  }
} catch (error) {
  // parseArgs reports bad options as TypeErrors carrying an ERR_PARSE_ARGS_* code.
  const badOption = error instanceof TypeError && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS');
  if (!(error instanceof InputError) && !badOption) {
    throw error;
  }
  console.error(error instanceof UsageError || badOption ? `${error.message}\n\n${USAGE}` : error.message);
  process.exitCode = 1;
}
