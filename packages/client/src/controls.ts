import type { Side } from '@factor/sim';
import { queuePlay, type MatchLoop } from './match-loop.ts';
import { contains, toArena, type ScreenLayout } from './screen-layout.ts';

/** The player's input state: which hand slot, if any, is waiting for a spot in the arena. */
export interface Controls {
  side: Side;
  selected: number | null;
}

/**
 * A tap at a screen point. Tapping a card selects it (tapping it again deselects it); tapping the
 * arena with a card selected plays it there as a command. The sim decides whether the play is legal.
 */
export function tap(controls: Controls, loop: MatchLoop, layout: ScreenLayout, x: number, y: number): void {
  const slot = layout.hud.slots.findIndex((rect) => contains(rect, x, y));
  if (slot >= 0) {
    controls.selected = controls.selected === slot ? null : slot;
    return;
  }
  const point = toArena(layout.view, loop.current.arena, x, y);
  if (point !== null && controls.selected !== null) {
    queuePlay(loop, controls.side, controls.selected, point.x, point.y);
    controls.selected = null;
  }
}
