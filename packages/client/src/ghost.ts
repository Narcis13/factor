import { formation, MILLI_PER_TILE, placementRejection, type Side, type SimState } from '@factor/sim';
import { pointToScreen } from './arena-view.ts';
import { toArena, type ScreenLayout, type ScreenPoint } from './screen-layout.ts';

/**
 * Where the selected card would land if the arena were tapped where the pointer is, drawn before the tap
 * (pillar 4: feedback before the play): every unit of a troop's group, a building's square, a spell's
 * circle. `status` says what the sim would make of it: taken, refused (out of the zone, on a tower...),
 * or waiting on energy.
 */
export interface GhostShape {
  shape: 'circle' | 'square';
  x: number;
  y: number;
  /** Half the square's side, for a square. */
  radius: number;
  status: 'ok' | 'refused' | 'energy';
}

export function ghostScene(state: SimState, side: Side, selected: number | null, hover: ScreenPoint | null, layout: ScreenLayout): GhostShape[] {
  if (selected === null || hover === null || state.result !== null) {
    return [];
  }
  const card = state.players[side].hand[selected];
  const stats = card === undefined ? undefined : state.cards[card];
  const point = toArena(layout.view, state.arena, hover.x, hover.y);
  if (stats === undefined || point === null) {
    return [];
  }
  const refused = placementRejection(state, side, stats, point.x, point.y) !== null;
  const status = refused ? 'refused' : state.players[side].energy < stats.cost ? 'energy' : 'ok';
  const scale = layout.view.tilePx / MILLI_PER_TILE;
  const at = pointToScreen(layout.view, point.x, point.y);
  if (stats.type === 'spell') {
    return [{ shape: 'circle', ...at, radius: stats.spell.radius * scale, status }];
  }
  if (stats.type === 'building') {
    return [{ shape: 'square', ...at, radius: stats.unit.radius * scale, status }];
  }
  // A group spreads as it will on deploy.
  return formation(state.arena, { side, ...point }, stats.unit.count, stats.unit.radius).map((spot) => ({
    shape: 'circle',
    ...pointToScreen(layout.view, spot.x, spot.y),
    radius: stats.unit.radius * scale,
    status,
  }));
}
