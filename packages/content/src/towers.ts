import type { TowerKind, TowerStats } from '@factor/sim';

/** Initial values (VISION §4): the Keep outlasts an Outpost. Damage and range come when towers shoot. */
export const TOWER_STATS: Record<TowerKind, TowerStats> = {
  keep: { hp: 4000 },
  outpost: { hp: 2500 },
};
