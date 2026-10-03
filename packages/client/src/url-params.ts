/** The page's own query parameters, read strictly: anything that isn't a plain number is ignored. */

const UINT32 = 0x100000000;

/** `?tick=<n>`: a whole number of ticks, or `null`. */
export function parseTick(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

/** `?seed=<n>`: a match seed in [0, 2³²), or `null`. */
export function parseSeed(value: string | null): number | null {
  const seed = parseTick(value);
  return seed !== null && seed < UINT32 ? seed : null;
}

/** A seed for a new match, from `random` in [0, 1) (the client's own randomness, never the sim's). */
export function freshSeed(random: () => number): number {
  return Math.floor(random() * UINT32) % UINT32;
}
