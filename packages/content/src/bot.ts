import { MILLI_PER_TILE, TICKS_PER_SECOND } from '@factor/sim';

/** How the bots play. Ticks, milli-tiles, energy and milli-energy (a card's cost × 1000). */
export interface BotTuning {
  /** The random bot waits at least this long after a play (and at the start)... */
  minWaitTicks: number;
  /** ...and at most this long, plus however long it takes to afford the card it picked. */
  maxWaitTicks: number;
  heuristic: HeuristicTuning;
}

/** The heuristic bot (VISION §8, Stage 3). */
export interface HeuristicTuning {
  /** How often it looks at the field when it has nothing to play: its reaction time. */
  thinkTicks: number;
  /** At least this long between two of its plays. */
  playGapTicks: number;
  /** An enemy counts as a threat once it is this close to the river on its own side (or across it). */
  threatReach: number;
  /** It defends once the threats are worth this much, or at once against a building-hunter... */
  defendValue: number;
  /** ...and only if they outweigh what already stands against them: its units within this of a threat... */
  guardRadius: number;
  /** ...and this much for each of its towers one is in reach of. */
  towerGuard: number;
  /** A spell must destroy at least this share of its own cost, in basis points. */
  spellValueBp: number;
  /** A defender's score: the value it can hit, plus these for splash against swarms and a building against hunters... */
  splashBonus: number;
  pullBonus: number;
  /** ...less this per energy it costs. */
  costWeight: number;
  /** Defending buildings go this deep into its half, in front of the Keep. */
  pullDepth: number;
  /** A troop with at least this range counts as ranged: it defends from by the towers, this deep. */
  rangedRange: number;
  rangedDepth: number;
  /** A close-in defender goes this far nearer its towers than the threat. */
  meetAhead: number;
  /** Its own units shallower than this in its half (or across) count as pushing; it backs them up this far behind. */
  pushingDepth: number;
  supportBehind: number;
  /** It keeps this much energy after backing up a push... */
  reserveEnergy: number;
  /** ...and starts one of its own with at least this much. */
  pushEnergy: number;
}

const TILE = MILLI_PER_TILE;

/**
 * The random bot plays every 1 to 4 s. The heuristic bot reacts within half a second and plays at most
 * one card a second; it saves to 9 energy for a push and defends anything worth 2 energy or more.
 */
export const BOT_TUNING: BotTuning = {
  minWaitTicks: TICKS_PER_SECOND,
  maxWaitTicks: 4 * TICKS_PER_SECOND,
  heuristic: {
    thinkTicks: TICKS_PER_SECOND / 2,
    playGapTicks: TICKS_PER_SECOND,
    threatReach: 2 * TILE,
    defendValue: 2000,
    guardRadius: 5 * TILE,
    towerGuard: 1500,
    spellValueBp: 11_000,
    splashBonus: 2000,
    pullBonus: 3000,
    costWeight: 300,
    pullDepth: 7 * TILE,
    rangedRange: 2 * TILE,
    rangedDepth: 7 * TILE,
    meetAhead: 2 * TILE,
    pushingDepth: 3 * TILE,
    supportBehind: 3 * TILE,
    reserveEnergy: 1,
    pushEnergy: 8,
  },
};
