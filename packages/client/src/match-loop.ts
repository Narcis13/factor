import { step, TICKS_PER_SECOND, type Blast, type Command, type Side, type SimState } from '@factor/sim';

/** Real time per tick: 50 ms at 20 ticks/s. */
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/**
 * At most this many ticks per frame. After a stall (a background tab, a debugger) the match slows
 * down instead of freezing the page to catch up.
 */
export const MAX_TICKS_PER_FRAME = 5;

/** How long a landed spell stays on screen: half a second. */
export const BLAST_TICKS = TICKS_PER_SECOND / 2;

/** A spell that landed, and the tick of the state it landed in. */
export interface RecentBlast extends Blast {
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
  /** Every command sent to the sim, in order: what a replay needs. */
  commands: Command[];
  /** Spells that landed in the last `BLAST_TICKS` ticks, oldest first, for the client to show. */
  blasts: RecentBlast[];
}

export function createLoop(state: SimState): MatchLoop {
  return { previous: state, current: state, pendingMs: 0, queued: [], commands: [], blasts: [] };
}

/** Queues a play for the next tick. Once the match has ended, it is dropped. */
export function queuePlay(loop: MatchLoop, side: Side, handSlot: number, x: number, y: number): void {
  if (loop.current.result === null) {
    loop.queued.push({ side, handSlot, x, y });
  }
}

/** Adds a frame's elapsed real time and steps every tick that is due. Returns the number of ticks stepped. */
export function advance(loop: MatchLoop, elapsedMs: number): number {
  if (loop.current.result !== null) {
    loop.pendingMs = 0;
    return 0;
  }
  loop.pendingMs = Math.min(loop.pendingMs + Math.max(0, elapsedMs), MAX_TICKS_PER_FRAME * TICK_MS);
  let ticks = 0;
  while (loop.pendingMs >= TICK_MS && loop.current.result === null) {
    const tick = loop.current.tick;
    const commands = loop.queued.map((play): Command => ({ tick, ...play }));
    loop.queued = [];
    loop.commands.push(...commands);
    loop.previous = loop.current;
    loop.current = step(loop.current, commands);
    const now = loop.current.tick;
    loop.blasts = loop.blasts.filter((blast) => now - blast.tick < BLAST_TICKS);
    loop.blasts.push(...loop.current.blasts.map((blast) => ({ ...blast, tick: now })));
    loop.pendingMs -= TICK_MS;
    ticks++;
  }
  if (loop.current.result !== null) {
    loop.pendingMs = 0;
  }
  return ticks;
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
