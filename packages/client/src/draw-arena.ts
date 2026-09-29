import type { Graphics } from 'pixi.js';
import type { GroundKind, HpBar, ScreenRect, Shape, UnitShape } from './arena-view.ts';
import { cardColor, SIDE_COLOR } from './palette.ts';

export { BACKGROUND } from './palette.ts';

const GROUND: Record<GroundKind, number> = {
  'tile-light': 0x7cb35a,
  'tile-dark': 0x70a94f,
  river: 0x3f86c9,
  bridge: 0xa07b4f,
};
const TOWER_EDGE = 0x1d2733;
const RUBBLE = 0x6b6f75;
const HP_TRACK = 0x1d2733;
const NO_DEPLOY = 0x000000;

export function drawArena(graphics: Graphics, shapes: Shape[]): void {
  for (const shape of shapes) {
    const { x, y, width, height } = shape.rect;
    graphics.rect(x, y, width, height);
    if (shape.kind === 'keep' || shape.kind === 'outpost') {
      // A fallen tower stays as grey rubble, ringed in its side's color.
      const [fill, edge] = shape.fallen ? [RUBBLE, SIDE_COLOR[shape.side]] : [SIDE_COLOR[shape.side], TOWER_EDGE];
      graphics.fill({ color: fill }).stroke({ color: edge, width: 2 });
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

/** A dark track with the hp left filled in the owner's color. */
export function drawHpBars(graphics: Graphics, bars: HpBar[]): void {
  for (const { side, rect, fraction } of bars) {
    graphics.rect(rect.x, rect.y, rect.width, rect.height).fill({ color: HP_TRACK });
    graphics.rect(rect.x, rect.y, rect.width * fraction, rect.height).fill({ color: SIDE_COLOR[side] });
  }
}
