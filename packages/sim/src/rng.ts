/**
 * sfc32 generator state (Chris Doty-Humphrey's Small Fast Chaotic PRNG, as in PractRand).
 * Four uint32 words, stored inside the sim state, so it serializes as plain JSON.
 */
export interface Rng {
  a: number;
  b: number;
  c: number;
  counter: number;
}

const UINT32_MAX = 0xffffffff;

/** Seeds the generator as PractRand does for a 32-bit seed: b = seed, then 12 discarded outputs. */
export function seedRng(seed: number): Rng {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError(`Seed must be a uint32, got ${String(seed)}`);
  }
  const rng: Rng = { a: 0, b: seed, c: 0, counter: 1 };
  for (let i = 0; i < 12; i++) {
    nextUint32(rng);
  }
  return rng;
}

/** Advances `rng` in place and returns the next uint32. */
export function nextUint32(rng: Rng): number {
  const result = (rng.a + rng.b + rng.counter) >>> 0;
  rng.counter = (rng.counter + 1) >>> 0;
  rng.a = (rng.b ^ (rng.b >>> 9)) >>> 0;
  rng.b = (rng.c + (rng.c << 3)) >>> 0;
  rng.c = (((rng.c << 21) | (rng.c >>> 11)) + result) >>> 0;
  return result;
}

const RANGE = 0x100000000;

/** A uniform integer in [0, bound), without modulo bias: draws that would favor low values are redrawn. */
export function nextBelow(rng: Rng, bound: number): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > RANGE) {
    throw new RangeError(`Bound must be an integer in [1, 2^32], got ${String(bound)}`);
  }
  const limit = RANGE - (RANGE % bound);
  for (;;) {
    const value = nextUint32(rng);
    if (value < limit) {
      return value % bound;
    }
  }
}

/** Shuffles `items` in place (Fisher–Yates), drawing from `rng`. */
export function shuffle(rng: Rng, items: string[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextBelow(rng, i + 1);
    const [a, b] = [items[i], items[j]];
    if (a === undefined || b === undefined) {
      throw new RangeError('shuffle index out of range');
    }
    items[i] = b;
    items[j] = a;
  }
}
