import type { Side } from '@factor/sim';
import type { Graphics } from 'pixi.js';
import type { GroundKind, Shape } from './arena-view.ts';

// Placeholder palette until art direction is decided (VISION §11). Side 0 is blue, side 1 is red.
export const BACKGROUND = 0x14181d;
const GROUND: Record<GroundKind, number> = {
  'tile-light': 0x7cb35a,
  'tile-dark': 0x70a94f,
  river: 0x3f86c9,
  bridge: 0xa07b4f,
};
const SIDE: Record<Side, number> = { 0: 0x3b74e0, 1: 0xd9483b };
const TOWER_EDGE = 0x1d2733;

export function drawArena(graphics: Graphics, shapes: Shape[]): void {
  for (const shape of shapes) {
    const { x, y, width, height } = shape.rect;
    graphics.rect(x, y, width, height);
    if (shape.kind === 'keep' || shape.kind === 'outpost') {
      graphics.fill({ color: SIDE[shape.side] }).stroke({ color: TOWER_EDGE, width: 2 });
    } else {
      graphics.fill({ color: GROUND[shape.kind] });
    }
  }
}
