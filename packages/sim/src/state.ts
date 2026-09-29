import type { ArenaLayout, Terrain, Tower, TowerKind, TowerStats } from './arena.ts';
import { hashJson } from './hash.ts';
import { seedRng, type Rng } from './rng.ts';

export type Side = 0 | 1;

/** A player action (VISION §5). The sim validates it; invalid commands do nothing and are recorded. */
export interface Command {
  tick: number;
  side: Side;
  handSlot: number;
  x: number;
  y: number;
}

/** `empty-slot`: no card in that hand slot. Hands stay empty until Stage 1, so every command gets this. */
export type RejectReason = 'wrong-tick' | 'empty-slot';

export interface RejectedCommand {
  command: Command;
  reason: RejectReason;
}

/** Match timing in ticks (VISION §4). The numbers come from `content`, which the sim can't import. */
export interface MatchRules {
  /** When regulation runs out, the side with more stars wins. */
  regulationTicks: number;
  /** Runs while stars are tied after regulation. The first star wins; still tied at its end is a draw. */
  overtimeTicks: number;
}

/** How the match ended. A `null` winner is a draw. */
export interface MatchResult {
  winner: Side | null;
}

/** The whole match as plain JSON: integers only, no classes or Maps (VISION §5). */
export interface SimState {
  tick: number;
  rng: Rng;
  rules: MatchRules;
  /** Never changes during a match; each state has its own copy. */
  arena: Terrain;
  /** Ascending by id. */
  towers: Tower[];
  /** Stars earned, indexed by `Side`. */
  stars: [number, number];
  /** `null` while the match runs. Set by the step that ends it; stepping further throws. */
  result: MatchResult | null;
  /** Commands rejected by the step that produced this state, in resolution order. */
  rejected: RejectedCommand[];
}

/** Everything a match starts from. The numbers come from `content` (D7). */
export interface MatchSetup {
  seed: number;
  rules: MatchRules;
  arena: ArenaLayout;
  towerStats: Record<TowerKind, TowerStats>;
}

export function createMatch(setup: MatchSetup): SimState {
  const { regulationTicks, overtimeTicks } = setup.rules;
  requireInteger('regulationTicks', regulationTicks, 1);
  requireInteger('overtimeTicks', overtimeTicks, 0);
  for (const kind of ['keep', 'outpost'] as const) {
    requireInteger(`${kind} hp`, setup.towerStats[kind].hp, 1);
  }
  // Fields are copied one by one, so nothing from the setup is shared with the state or leaks into it.
  const towers = setup.arena.towers.map(({ kind, side, lane, x, y, size }, id): Tower => {
    const { hp } = setup.towerStats[kind];
    return { id, kind, side, lane, x, y, size, hp, maxHp: hp };
  });
  return {
    tick: 0,
    rng: seedRng(setup.seed),
    rules: { regulationTicks, overtimeTicks },
    arena: copyTerrain(setup.arena),
    towers,
    stars: [0, 0],
    result: null,
    rejected: [],
  };
}

/** FNV-1a over the canonical serialization of the state, as 8 hex digits. */
export function hashState(state: SimState): string {
  return hashJson(state);
}

export function copyTerrain({ width, height, river, bridges }: Terrain): Terrain {
  return {
    width,
    height,
    river: { x: river.x, y: river.y, width: river.width, height: river.height },
    bridges: bridges.map(({ lane, x, y, width: w, height: h }) => ({ lane, x, y, width: w, height: h })),
  };
}

function requireInteger(name: string, value: number, min: number): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${name} must be an integer ≥ ${String(min)}, got ${String(value)}`);
  }
}
