import { TICKS_PER_SECOND, type MatchRules } from '@factor/sim';

/** Match timing (VISION §4): 3:00 of regulation, then up to 2:00 of overtime while stars are tied. */
export const MATCH_RULES: MatchRules = {
  regulationTicks: 180 * TICKS_PER_SECOND,
  overtimeTicks: 120 * TICKS_PER_SECOND,
};
