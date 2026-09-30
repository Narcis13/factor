import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadReplay, saveReplay, type Replay } from '@factor/content';
import { TICKS_PER_SECOND } from '@factor/sim';
import { botReplay, describeResult, playReplay } from './match.ts';
import type { ShotRequest } from './shots.ts';

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

  shots [--out <dir>] [--replay <file>] [--tick <n>]
      Open the client frozen in headless Chromium and save PNGs in <dir> (default: shots). With no
      options: arena.png (live against the bot at tick 90) and end.png (the end of bot-vs-bot seed 0,
      played back with ?replay=). --tick <n> shoots the live match at tick n as arena-<n>.png.
      --replay <file> plays that replay back to --tick (default: its end) as <file name>-<n|end>.png.
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
  const loaded = readReplayFile(file);
  if (values.dump !== undefined) {
    dump(loaded, values.dump);
    return;
  }
  console.log(describeResult(loaded.seed, playReplay(loaded)));
}

/** Loads and validates a replay file; any problem is bad input, named after the file. */
function readReplayFile(file: string): Replay {
  try {
    return loadReplay(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new InputError(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  const { values } = parseArgs({
    args,
    options: { out: { type: 'string', default: 'shots' }, replay: { type: 'string' }, tick: { type: 'string' } },
  });
  // Loaded here so the other commands don't pay for starting Vite and Playwright.
  const { defaultShots, END_TICK, SHOT_VIEWPORT, shoot } = await import('./shots.ts');
  const tick = values.tick === undefined ? undefined : parseInteger('--tick', values.tick, Number.MAX_SAFE_INTEGER);
  let requests: ShotRequest[];
  if (values.replay !== undefined) {
    const name = `${basename(values.replay, extname(values.replay))}-${tick === undefined ? 'end' : String(tick)}`;
    requests = [{ name, tick: tick ?? END_TICK, replay: readReplayFile(values.replay) }];
  } else {
    requests = tick === undefined ? defaultShots() : [{ name: `arena-${String(tick)}`, tick }];
  }
  const taken = await shoot(requests);
  await mkdir(values.out, { recursive: true });
  const size = `${String(SHOT_VIEWPORT.width)}×${String(SHOT_VIEWPORT.height)}`;
  for (const shot of taken) {
    const file = join(values.out, `${shot.name}.png`);
    await writeFile(file, shot.png);
    const sha = createHash('sha256').update(shot.png).digest('hex').slice(0, 12);
    console.log(`saved ${file}  ${size}  ${shot.renderer}  sha256 ${sha}`);
  }
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
