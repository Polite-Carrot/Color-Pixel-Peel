/**
 * Deterministic PRNG (mulberry32).
 *
 * Level generation must be reproducible: the same seed has to yield the
 * same board on every device and in every test run, so we never rely on
 * `Math.random()`.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, max). Returns 0 when max <= 0. */
  int(max: number): number;
  /** Uniformly picks one item; throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** In-place Fisher-Yates shuffle, returning the same array. */
  shuffle<T>(items: T[]): T[];
}

export function createRng(seed: number): Rng {
  // Any 32-bit state works; force an integer so callers can pass floats.
  let state = Math.trunc(seed) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (max: number): number => (max <= 0 ? 0 : Math.floor(next() * max));

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      return items[int(items.length)] as T;
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const a = items[i] as T;
        const b = items[j] as T;
        items[i] = b;
        items[j] = a;
      }
      return items;
    },
  };
}
