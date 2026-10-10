import { botTurn, type Bot } from '@factor/bot';
import { BOT_TUNING } from '@factor/content';
import { step, TICKS_PER_SECOND, type Blast, type Command, type Side, type SimState, type Splash } from '@factor/sim';
import { EFFECT_LIFE, effectsBetween, type Effect } from './effects.ts';

/** Real time per tick: 50 ms at 20 ticks/s. */
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/**
 * At most this many ticks per frame. After a stall (a background tab, a debugger) the match slows
 * down instead of freezing the page to catch up.
 */
export const MAX_TICKS_PER_FRAME = 5;

/** How long a landed spell or splash is kept for the screen: two seconds, for a burn mark to fade. */
export const BLAST_TICKS = 2 * TICKS_PER_SECOND;

/** A spell that landed, and the tick of the state it landed in. */
export interface RecentBlast extends Blast {
  tick: number;
}

/** A splash hit that landed, and the tick of the state it landed in. */
export interface RecentSplash extends Splash {
  tick: number;
}

/** A command before it has a tick: the loop stamps it with the tick it is played on. */
export type Play = Omit<Command, 'tick'>;

/**
 * Drives the sim at a fixed tick from a variable frame rate (VISION §5). The client reads
 * `previous` and `current` to interpolate; it never writes to them.
 */
export interface MatchLoop {
  previous: SimState;
  current: SimState;
  /** Real time accumulated toward the next tick, in [0, TICK_MS) while the match runs. */
  pendingMs: number;
  /** Plays waiting for the next tick. */
  queued: Play[];
  /** Bots playing sides the human doesn't, asked for their commands every tick. */
  bots: Bot[];
  /** A replay's commands still to come, in tick order, each sent on its own tick. Empty in live play. */
  feed: Command[];
  /** Every command sent to the sim, in order: what a replay needs. */
  commands: Command[];
  /** Spells that landed in the last `BLAST_TICKS` ticks, oldest first, for the client to show. */
  blasts: RecentBlast[];
  /** Splash hits that landed in the last `BLAST_TICKS` ticks, oldest first. */
  splashes: RecentSplash[];
  /** Hits, deaths, arrivals, fallen towers and shots, each kept for its `EFFECT_LIFE`, oldest first. */
  effects: Effect[];
}

export function createLoop(state: SimState, bots: Bot[] = [], feed: readonly Command[] = []): MatchLoop {
  return { previous: state, current: state, pendingMs: 0, queued: [], bots, feed: [...feed], commands: [], blasts: [], splashes: [], effects: [] };
}

/** Queues a play for the next tick. Once the match has ended, it is dropped. */
export function queuePlay(loop: MatchLoop, side: Side, handSlot: number, x: number, y: number): void {
  if (loop.current.result === null) {
    loop.queued.push({ side, handSlot, x, y });
  }
}

/** Adds a frame's elapsed real time and steps every tick that is due. Returns the number of ticks stepped. */
export function advance(loop: MatchLoop, elapsedMs: number): number {
  if (ended(loop)) {
    loop.pendingMs = 0;
    return 0;
  }
  loop.pendingMs = Math.min(loop.pendingMs + Math.max(0, elapsedMs), MAX_TICKS_PER_FRAME * TICK_MS);
  let ticks = 0;
  while (loop.pendingMs >= TICK_MS && !ended(loop)) {
    tickOnce(loop);
    loop.pendingMs -= TICK_MS;
    ticks++;
  }
  if (ended(loop)) {
    loop.pendingMs = 0;
  }
  return ticks;
}

/**
 * Steps the loop, bots included, up to `tick` or to the end of the match, as if that much time had
 * passed with no taps. Leaves the display at `current`.
 */
export function runTo(loop: MatchLoop, tick: number): void {
  while (loop.current.tick < tick && !ended(loop)) {
    tickOnce(loop);
  }
  loop.pendingMs = 0;
}

/** A function, not an inline check, so a narrowed `result` doesn't outlive the step that changes it. */
function ended(loop: MatchLoop): boolean {
  return loop.current.result !== null;
}

/**
 * One tick: the human's queued plays, the bots' turns and the replay's commands for this tick become
 * this tick's commands. A replay's commands keep their recorded order, so it plays back exactly.
 */
function tickOnce(loop: MatchLoop): void {
  const state = loop.current;
  const tick = state.tick;
  const commands = loop.queued.map((play): Command => ({ tick, ...play }));
  loop.queued = [];
  let due = 0;
  while (loop.feed[due]?.tick === tick) {
    due++;
  }
  commands.push(...loop.feed.slice(0, due));
  loop.feed = loop.feed.slice(due);
  loop.bots = loop.bots.map((bot) => {
    const turn = botTurn(bot, state, BOT_TUNING);
    commands.push(...turn.commands);
    return turn.bot;
  });
  loop.commands.push(...commands);
  loop.previous = state;
  loop.current = step(state, commands);
  const now = loop.current.tick;
  loop.blasts = loop.blasts.filter((blast) => now - blast.tick < BLAST_TICKS);
  loop.blasts.push(...loop.current.blasts.map((blast) => ({ ...blast, tick: now })));
  loop.splashes = loop.splashes.filter((splash) => now - splash.tick < BLAST_TICKS);
  loop.splashes.push(...loop.current.splashes.map((splash) => ({ ...splash, tick: now })));
  loop.effects = loop.effects.filter((effect) => now - effect.tick < EFFECT_LIFE[effect.kind]);
  loop.effects.push(...effectsBetween(state, loop.current));
}

/** How far the display is from `previous` toward `current`, in [0, 1]. */
export function alpha(loop: MatchLoop): number {
  return loop.current.result === null ? loop.pendingMs / TICK_MS : 1;
}

/** Steps a match with no commands up to `tick`, or to its end if that comes first. */
export function stepTo(state: SimState, tick: number): SimState {
  let current = state;
  while (current.tick < tick && current.result === null) {
    current = step(current, []);
  }
  return current;
}
