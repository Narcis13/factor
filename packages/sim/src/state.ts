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

/** The whole match as plain JSON: integers only, no classes or Maps (VISION §5). */
export interface SimState {
  tick: number;
  rng: Rng;
  /** Commands rejected by the step that produced this state, in resolution order. */
  rejected: RejectedCommand[];
}

export interface MatchSetup {
  seed: number;
}

export function createMatch(setup: MatchSetup): SimState {
  return { tick: 0, rng: seedRng(setup.seed), rejected: [] };
}

/** FNV-1a over the canonical serialization of the state, as 8 hex digits. */
export function hashState(state: SimState): string {
  return hashJson(state);
}
