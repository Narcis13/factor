import { TICKS_PER_SECOND, type TowerKind, type TowerStats } from '@factor/sim';

/**
 * Initial values (VISION §4): the Keep outlasts an Outpost and hits a little harder. Both reach 7 tiles
 * past their footprint (an Outpost covers its side up to the river) and shoot every 0.8 s, their shots
 * flying 16 tiles/s.
 */
export const TOWER_STATS: Record<TowerKind, TowerStats> = {
  keep: { hp: 4000, damage: 100, splash: 0, projectileSpeed: 800, range: 7000, hitTicks: (8 * TICKS_PER_SECOND) / 10, firstHitTicks: TICKS_PER_SECOND / 2 },
  outpost: { hp: 2500, damage: 90, splash: 0, projectileSpeed: 800, range: 7000, hitTicks: (8 * TICKS_PER_SECOND) / 10, firstHitTicks: TICKS_PER_SECOND / 2 },
};
