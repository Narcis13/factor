import { formation, placementRejection, type CardId, type Side, type SimState } from '@factor/sim';

/**
 * Where the selected card would land if the arena were tapped at `point` (milli-tiles), worked out before
 * the tap (pillar 4: feedback before the play): every unit of a troop's group, a building's spot, a spell's
 * center. `status` says what the sim would make of it: taken, refused (out of the zone, on a tower...),
 * or waiting on energy.
 */
export interface GhostPlan {
  card: CardId;
  side: Side;
  x: number;
  y: number;
  spots: { x: number; y: number }[];
  status: 'ok' | 'refused' | 'energy';
}

export function ghostPlan(state: SimState, side: Side, selected: number | null, point: { x: number; y: number } | null): GhostPlan | null {
  if (selected === null || point === null || state.result !== null) {
    return null;
  }
  const card = state.players[side].hand[selected];
  const stats = card === undefined ? undefined : state.cards[card];
  if (card === undefined || stats === undefined) {
    return null;
  }
  const refused = placementRejection(state, side, stats, point.x, point.y) !== null;
  const status = refused ? 'refused' : state.players[side].energy < stats.cost ? 'energy' : 'ok';
  const spots = stats.type === 'troop' ? formation(state.arena, { side, ...point }, stats.unit.count, stats.unit.radius) : [{ ...point }];
  return { card, side, ...point, spots, status };
}
