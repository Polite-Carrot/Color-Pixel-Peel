/**
 * Deterministic PRNG (mulberry32).
 *
 * The deal is shuffled, but a level must still be the same board for
 * everyone every time — so it is shuffled from a seed rather than from
 * `Math.random()`. That is also what lets the tests prove a level is
 * winnable: they play the deal the player will actually get.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, max). Returns 0 when max <= 0. */
  int(max: number): number;
  /** In-place Fisher-Yates shuffle, returning the same array. */
  shuffle<T>(items: T[]): T[];
}

export function createRng(seed: number): Rng {
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
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const a = items[i] as T;
        items[i] = items[j] as T;
        items[j] = a;
      }
      return items;
    },
  };
}
