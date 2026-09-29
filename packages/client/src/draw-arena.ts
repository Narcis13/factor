import type { Graphics } from 'pixi.js';
import type { GroundKind, ScreenRect, Shape, UnitShape } from './arena-view.ts';
import { cardColor, SIDE_COLOR } from './palette.ts';

export { BACKGROUND } from './palette.ts';

const GROUND: Record<GroundKind, number> = {
  'tile-light': 0x7cb35a,
  'tile-dark': 0x70a94f,
  river: 0x3f86c9,
  bridge: 0xa07b4f,
};
const TOWER_EDGE = 0x1d2733;
const NO_DEPLOY = 0x000000;

export function drawArena(graphics: Graphics, shapes: Shape[]): void {
  for (const shape of shapes) {
    const { x, y, width, height } = shape.rect;
    graphics.rect(x, y, width, height);
    if (shape.kind === 'keep' || shape.kind === 'outpost') {
      graphics.fill({ color: SIDE_COLOR[shape.side] }).stroke({ color: TOWER_EDGE, width: 2 });
    } else {
      graphics.fill({ color: GROUND[shape.kind] });
    }
  }
}

/** Darkens where the selected troop can't go. */
export function drawNoDeploy(graphics: Graphics, rect: ScreenRect): void {
  graphics.rect(rect.x, rect.y, rect.width, rect.height).fill({ color: NO_DEPLOY, alpha: 0.35 });
}

/** A unit is its card's color ringed in its side's; faint while it deploys. */
export function drawUnits(graphics: Graphics, units: UnitShape[]): void {
  for (const unit of units) {
    const alpha = unit.deploying ? 0.45 : 1;
    graphics
      .circle(unit.x, unit.y, unit.radius)
      .fill({ color: cardColor(unit.card), alpha })
      .stroke({ color: SIDE_COLOR[unit.side], width: 3, alpha });
  }
}
