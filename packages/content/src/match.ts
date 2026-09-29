import { TICKS_PER_SECOND, type MatchRules } from '@factor/sim';

/**
 * Match rules (VISION §4): 3:00 of regulation, then up to 2:00 of overtime while stars are tied.
 * Decks of 8, hands of 4. Energy starts at 5 and regenerates one per 2.8 s up to 10, twice as fast
 * in the final 60 s of regulation and in overtime.
 */
export const MATCH_RULES: MatchRules = {
  regulationTicks: 180 * TICKS_PER_SECOND,
  overtimeTicks: 120 * TICKS_PER_SECOND,
  deckSize: 8,
  handSize: 4,
  energy: {
    start: 5,
    max: 10,
    ticksPerEnergy: (28 * TICKS_PER_SECOND) / 10,
    doubleFromTick: (180 - 60) * TICKS_PER_SECOND,
  },
};
