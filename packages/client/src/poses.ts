// How a sprite stands this frame, from the sim's state alone: which way it looks, and which attack frame
// its cooldown puts it on. Pure, so frozen shots and live play pick the same frames.
import type { Side } from '@factor/sim';
import type { Facing } from './art/frame.ts';

/** Which way to look along (dx, dy) in arena space (y toward side 1), and whether to mirror the side view. */
export function facingTo(dx: number, dy: number): [Facing, boolean] {
  if (Math.abs(dx) > Math.abs(dy) * 1.2) {
    return ['side', dx < 0];
  }
  return [dy > 0 ? 'up' : 'down', false];
}

/** At rest, a unit looks toward the enemy: side 0 up the screen, side 1 down it. */
export function restFacing(side: Side): Facing {
  return side === 0 ? 'up' : 'down';
}

/**
 * The attack frame for a hit every `hitTicks` with `cooldown` ticks to the next: the strike for two
 * ticks after a hit, then the follow-through, then ready, winding up for the last three ticks.
 */
export function attackFrame(cooldown: number, hitTicks: number): number {
  const since = hitTicks - cooldown;
  if (since >= 0 && since < 2) {
    return 2;
  }
  if (since >= 2 && since < 4) {
    return 3;
  }
  return cooldown <= 3 ? 1 : 0;
}

