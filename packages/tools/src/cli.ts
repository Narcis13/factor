import { parseArgs } from 'node:util';
import { TICKS_PER_SECOND } from '@factor/sim';
import { describeResult, runMatch } from './match.ts';

const USAGE = `factor sim (${String(TICKS_PER_SECOND)} ticks/s)

Usage: pnpm sim <command>

Commands:
  match --seed <n> [--dump <tick>]
      Play an empty match headless, with invariants checked every tick, and print the result.
      With --dump, print the full state at <tick> as JSON instead.`;

const UINT32_MAX = 0xffffffff;

/** A mistake in how the CLI was called: print the message and usage, not a stack trace. */
class UsageError extends Error {}

function match(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: { seed: { type: 'string' }, dump: { type: 'string' } },
  });
  if (values.seed === undefined) {
    throw new UsageError('match needs --seed <n>');
  }
  const seed = parseInteger('--seed', values.seed, UINT32_MAX);
  if (values.dump === undefined) {
    console.log(describeResult(seed, runMatch(seed)));
    return;
  }
  const dumpTick = parseInteger('--dump', values.dump, Number.MAX_SAFE_INTEGER);
  const state = runMatch(seed, dumpTick);
  if (state.tick !== dumpTick) {
    throw new UsageError(`The match ended at tick ${String(state.tick)}, before tick ${String(dumpTick)}`);
  }
  console.log(JSON.stringify(state, null, 2));
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
  } else {
    throw new UsageError(`Unknown command: ${command}`);
  }
} catch (error) {
  // parseArgs reports bad options as TypeErrors carrying an ERR_PARSE_ARGS_* code.
  const badOption = error instanceof TypeError && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS');
  if (!(error instanceof UsageError) && !badOption) {
    throw error;
  }
  console.error(`${error.message}\n\n${USAGE}`);
  process.exitCode = 1;
}
