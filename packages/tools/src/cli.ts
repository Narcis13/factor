import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, posix } from 'node:path';
import { parseArgs } from 'node:util';
import { loadReplay, saveReplay, type Replay } from '@factor/content';
import { TICKS_PER_SECOND } from '@factor/sim';
import { botReplay, describeResult, playReplay } from './match.ts';
import { checkGoldens, GOLDEN_EVERY, GOLDEN_HASHES_FILE, updateGoldens } from './goldens.ts';
import { describeSweep, sweep } from './sweep.ts';
import { balance, describeBalance, OUTLIER_ERRORS, OUTLIER_POINTS } from './balance.ts';
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

  sweep --matches <n> [--from <seed>]
      Play <n> headless bot-vs-bot matches on seeds <seed> (default 0) onward. Each is played live, then
      played back from its replay with invariants checked every tick, and both must end on the same hash.
      Print results, match length, stars, tower damage, plays per card and rejections, then every seed
      that broke an invariant or didn't reproduce. Exits non-zero if any did. Progress goes to stderr.

  balance [--matches <n>] [--from <seed>]
      Play <n> (default 500) heuristic-bot mirror matches on seeds <seed> (default 0) onward, each on two
      random decks of eight different cards from the sixteen (the seed deals them), checked against their
      replays like sweep. Print each card's win rate (± one standard error), decided matches and plays per
      deck, best first, and flag outliers: ${String(OUTLIER_POINTS)}+ points off 50% and ${String(OUTLIER_ERRORS)}+ errors clear. Exits
      non-zero if a match failed. Progress goes to stderr.

  goldens [--update] [--dir <dir>]
      Play every golden replay in <dir> (default: goldens) with invariants checked every tick, and compare
      its state hashes every ${String(GOLDEN_EVERY)} ticks and at its end with those in <dir>/${GOLDEN_HASHES_FILE}. Print each golden
      and the first tick where it differs; exit non-zero if any does. --update stores fresh hashes instead:
      only after an intended change, and log why. To add a golden, save a replay into <dir> (for example
      with match --seed <n> --replay goldens/seed-<n>.json) and run --update.

  shots [--out <dir>] [--replay <file>] [--tick <n>] [--gallery <query>]
      Open the client frozen in headless Chromium and save PNGs in <dir> (default: shots). With no
      options: arena.png (live against the bot at tick 200) and end.png (the end of bot-vs-bot seed 0,
      played back with ?replay=). --tick <n> shoots the live match at tick n as arena-<n>.png.
      --replay <file> plays that replay back to --tick (default: its end) as <file name>-<n|end>.png.
      --gallery <query> captures the art gallery (?gallery&<query>, e.g. "section=units&unit=warden",
      or "" for all of it) whole, as gallery-<query>.png.
      Also runs as pnpm shots.

  playtest [--out <dir>]
      Play one live match in the client in headless Chromium, in real time (3-5 minutes): every 4 s,
      side 0 taps a card, then a spot 5 tiles short of the river in line with a bridge, against the
      bot. When the client saves the match's replay, play it back headless with invariants checked
      every tick, watch it in the client with ?replay=last, and check that both end screens are the
      same pixels. Saves playtest-live.png and playtest-replay.png in <dir> (default: shots), and the
      replay as replays/playtest.json. Exits non-zero on a page error or a mismatch. Also runs as pnpm playtest.`;

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
  // Forward slashes on every OS, so the printed path reads (and tests) the same everywhere.
  const file = values.replay ?? posix.join('replays', `seed-${String(replay.seed)}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, saveReplay(replay));
  console.log(`${describeResult(replay.seed, state)}\nreplay  ${file}`);
}

const SWEEP_PROGRESS_EVERY = 100;

function sweepCommand(args: string[]): void {
  const { values } = parseArgs({ args, options: { matches: { type: 'string' }, from: { type: 'string', default: '0' } } });
  if (values.matches === undefined) {
    throw new UsageError('sweep needs --matches <n>');
  }
  const matches = parseInteger('--matches', values.matches, UINT32_MAX);
  const from = parseInteger('--from', values.from, UINT32_MAX);
  if (matches === 0 || from + matches - 1 > UINT32_MAX) {
    throw new UsageError(`sweep needs 1 or more matches on seeds up to ${String(UINT32_MAX)}`);
  }
  const started = performance.now();
  const report = sweep(from, matches, (seed) => {
    const done = seed - from + 1;
    if (done % SWEEP_PROGRESS_EVERY === 0 && done < matches) {
      console.error(`swept ${String(done)}/${String(matches)}`);
    }
  });
  const seconds = (performance.now() - started) / 1000;
  console.log(`${describeSweep(report)}\ntook        ${seconds.toFixed(0)} s`);
  if (report.violations.length > 0 || report.mismatches.length > 0) {
    process.exitCode = 1;
  }
}

function balanceCommand(args: string[]): void {
  const { values } = parseArgs({ args, options: { matches: { type: 'string', default: '500' }, from: { type: 'string', default: '0' } } });
  const matches = parseInteger('--matches', values.matches, UINT32_MAX);
  const from = parseInteger('--from', values.from, UINT32_MAX);
  if (matches === 0 || from + matches - 1 > UINT32_MAX) {
    throw new UsageError(`balance needs 1 or more matches on seeds up to ${String(UINT32_MAX)}`);
  }
  const started = performance.now();
  const report = balance(from, matches, (seed) => {
    const done = seed - from + 1;
    if (done % SWEEP_PROGRESS_EVERY === 0 && done < matches) {
      console.error(`played ${String(done)}/${String(matches)}`);
    }
  });
  const seconds = (performance.now() - started) / 1000;
  console.log(`${describeBalance(report)}
took        ${seconds.toFixed(0)} s`);
  if (report.failures.length > 0) {
    process.exitCode = 1;
  }
}

function goldens(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: { update: { type: 'boolean', default: false }, dir: { type: 'string', default: 'goldens' } },
  });
  let checks;
  try {
    checks = values.update ? updateGoldens(values.dir) : checkGoldens(values.dir);
  } catch (error) {
    throw new InputError(error instanceof Error ? error.message : String(error));
  }
  const width = Math.max(...checks.map((check) => check.name.length));
  for (const { name, checkpoints, lastTick, problem } of checks) {
    const status = problem === null ? (values.update ? 'stored' : 'ok') : 'FAIL';
    const detail = problem ?? `${String(checkpoints)} checkpoints to tick ${String(lastTick)}`;
    console.log(`${name.padEnd(width)}  ${status.padEnd(6)}  ${detail}`);
  }
  if (checks.some((check) => check.problem !== null)) {
    process.exitCode = 1;
  }
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
    options: { out: { type: 'string', default: 'shots' }, replay: { type: 'string' }, tick: { type: 'string' }, gallery: { type: 'string' } },
  });
  // Loaded here so the other commands don't pay for starting Vite and Playwright.
  const { defaultShots, END_TICK, SHOT_VIEWPORT, shoot } = await import('./shots.ts');
  const tick = values.tick === undefined ? undefined : parseInteger('--tick', values.tick, Number.MAX_SAFE_INTEGER);
  let requests: ShotRequest[];
  if (values.gallery !== undefined) {
    const suffix = values.gallery.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    requests = [{ name: suffix === '' ? 'gallery' : `gallery-${suffix}`, tick: 0, gallery: values.gallery }];
  } else if (values.replay !== undefined) {
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

async function playtestCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({ args, options: { out: { type: 'string', default: 'shots' } } });
  // Loaded here so the other commands don't pay for starting Vite and Playwright.
  const { playtest } = await import('./playtest.ts');
  const report = await playtest();
  await mkdir(values.out, { recursive: true });
  const liveFile = join(values.out, 'playtest-live.png');
  const watchedFile = join(values.out, 'playtest-replay.png');
  const replayFile = join('replays', 'playtest.json');
  await writeFile(liveFile, report.live);
  await writeFile(watchedFile, report.watched);
  await mkdir(dirname(replayFile), { recursive: true });
  await writeFile(replayFile, saveReplay(report.replay));
  const reasons = Object.entries(report.rejected).map(([reason, count]) => `${String(count)} ${reason}`);
  const same = report.live.equals(report.watched);
  console.log(
    [
      describeResult(report.replay.seed, report.final),
      `side 0  ${String(report.taps)} plays tapped, ${String(report.accepted)} taken${reasons.length > 0 ? `, rejected: ${reasons.join(', ')}` : ''}`,
      `side 1  ${String(report.botPlays)} bot plays`,
      `replay=last  ${same ? 'the same end screen as live' : 'a DIFFERENT end screen from live'}`,
      `errors  ${report.errors.length > 0 ? report.errors.join('\n        ') : 'none'}`,
      `took    ${report.seconds.toFixed(0)} s`,
      `saved   ${liveFile}, ${watchedFile}, ${replayFile}`,
    ].join('\n'),
  );
  if (!same || report.errors.length > 0) {
    process.exitCode = 1;
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
  } else if (command === 'goldens') {
    goldens(args);
  } else if (command === 'sweep') {
    sweepCommand(args);
  } else if (command === 'balance') {
    balanceCommand(args);
  } else if (command === 'shots') {
    await shots(args);
  } else if (command === 'playtest') {
    await playtestCommand(args);
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
