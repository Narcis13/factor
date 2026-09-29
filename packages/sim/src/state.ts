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
  /** Stars earned, indexed by `Side`. */
  stars: [number, number];
  /** `null` while the match runs. Set by the step that ends it; stepping further throws. */
  result: MatchResult | null;
  /** Commands rejected by the step that produced this state, in resolution order. */
  rejected: RejectedCommand[];
}

export interface MatchSetup {
  seed: number;
  rules: MatchRules;
}

export function createMatch(setup: MatchSetup): SimState {
  const { regulationTicks, overtimeTicks } = setup.rules;
  requireTicks('regulationTicks', regulationTicks, 1);
  requireTicks('overtimeTicks', overtimeTicks, 0);
  return {
    tick: 0,
    rng: seedRng(setup.seed),
    rules: { regulationTicks, overtimeTicks },
    stars: [0, 0],
    result: null,
    rejected: [],
  };
}

/** FNV-1a over the canonical serialization of the state, as 8 hex digits. */
export function hashState(state: SimState): string {
  return hashJson(state);
}

function requireTicks(name: string, ticks: number, min: number): void {
  if (!Number.isSafeInteger(ticks) || ticks < min) {
    throw new RangeError(`${name} must be an integer ≥ ${String(min)}, got ${String(ticks)}`);
  }
}
