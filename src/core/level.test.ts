import { describe, expect, it } from 'vitest';
import { depthAt, cellCount, isCleared, peel, regionAt, topColor } from './board';
import { generateLevel, levelConfig, seedForLevel, verifySolution } from './level';

describe('levelConfig', () => {
  it('grows the grid, palette and solution length with the level', () => {
    const first = levelConfig(1);
    const later = levelConfig(20);
    expect(later.cols).toBeGreaterThan(first.cols);
    expect(later.rows).toBeGreaterThan(first.rows);
    expect(later.colors).toBeGreaterThan(first.colors);
    expect(later.targetMoves).toBeGreaterThan(first.targetMoves);
  });

  it('caps the grid and palette so late levels stay playable on a phone', () => {
    const far = levelConfig(500);
    expect(far.cols).toBeLessThanOrEqual(8);
    expect(far.rows).toBeLessThanOrEqual(11);
    expect(far.colors).toBeLessThanOrEqual(6);
    expect(far.maxStamp).toBeLessThanOrEqual(7);
  });

  it('clamps non-positive indices to level 1', () => {
    expect(levelConfig(0)).toEqual(levelConfig(1));
    expect(levelConfig(-5)).toEqual(levelConfig(1));
  });
});

describe('generateLevel', () => {
  it('is deterministic for a given seed', () => {
    const a = generateLevel(4, 12345);
    const b = generateLevel(4, 12345);
    expect(b.board).toEqual(a.board);
    expect(b.solution).toEqual(a.solution);
    expect(b.moveLimit).toBe(a.moveLimit);
  });

  it('produces different boards for different seeds', () => {
    const a = generateLevel(4, 1);
    const b = generateLevel(4, 2);
    expect(b.board).not.toEqual(a.board);
  });

  it('rejects impossible configs', () => {
    expect(() => generateLevel(1, 1, { colors: 1 })).toThrow(/at least 2 colors/);
    expect(() => generateLevel(1, 1, { maxStamp: 1 })).toThrow(/maxStamp/);
  });

  it('only uses colors from the configured palette slice', () => {
    const level = generateLevel(3, 99);
    for (const stack of level.board.cells) {
      for (const color of stack) {
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThan(level.config.colors);
      }
    }
  });

  it('leaves no hole in the starting board', () => {
    const level = generateLevel(6, seedForLevel(6));
    for (let i = 0; i < cellCount(level.board); i++) {
      expect(depthAt(level.board, i)).toBeGreaterThan(0);
    }
  });

  it('gives the player slack beyond the optimal solution', () => {
    const level = generateLevel(5, seedForLevel(5));
    expect(level.moveLimit).toBeGreaterThan(level.solution.length);
  });

  it('meets the target solution length', () => {
    const level = generateLevel(8, seedForLevel(8));
    expect(level.solution.length).toBeGreaterThanOrEqual(level.config.targetMoves);
  });

  // The core guarantee of the reverse-peel generator: no level can ever
  // ship without a working solution.
  it('ships a verified solution for every level on the real progression', () => {
    for (let index = 1; index <= 40; index++) {
      const level = generateLevel(index, seedForLevel(index));
      expect(verifySolution(level.board, level.solution), `level ${index} unsolvable`).toBe(true);
      expect(level.solution.length).toBeLessThanOrEqual(level.moveLimit);
    }
  });

  it('stays solvable across many arbitrary seeds', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const index = (seed % 25) + 1;
      const level = generateLevel(index, seed * 7919);
      expect(verifySolution(level.board, level.solution), `seed ${seed} unsolvable`).toBe(true);
    }
  });

  it('clears the board exactly on the last solution move, never early', () => {
    const level = generateLevel(7, seedForLevel(7));
    let board = level.board;
    level.solution.forEach((move, step) => {
      const result = peel(board, move);
      expect(result, `move ${step} was rejected`).not.toBeNull();
      board = result!.board;
      const last = step === level.solution.length - 1;
      expect(isCleared(board)).toBe(last);
    });
  });

  it('peels exactly the stamped region at each solution step', () => {
    // Every stamp is maximal by construction, so a solution tap must
    // never cascade into neighbouring cells of the same color.
    const level = generateLevel(9, seedForLevel(9));
    let board = level.board;
    for (const move of level.solution) {
      const expected = regionAt(board, move);
      const result = peel(board, move)!;
      expect([...result.peeled].sort()).toEqual([...expected].sort());
      expect(topColor(board, move)).toBe(result.color);
      board = result.board;
    }
  });
});

describe('verifySolution', () => {
  it('rejects a solution that leaves layers behind', () => {
    const level = generateLevel(2, seedForLevel(2));
    expect(verifySolution(level.board, level.solution.slice(0, -1))).toBe(false);
  });

  it('rejects an out-of-order solution', () => {
    const level = generateLevel(2, seedForLevel(2));
    const scrambled = [...level.solution].reverse();
    expect(verifySolution(level.board, scrambled)).toBe(false);
  });

  it('rejects an empty solution for a non-empty board', () => {
    const level = generateLevel(2, seedForLevel(2));
    expect(verifySolution(level.board, [])).toBe(false);
  });
});

describe('seedForLevel', () => {
  it('is stable and distinct per level', () => {
    expect(seedForLevel(3)).toBe(seedForLevel(3));
    const seeds = new Set(Array.from({ length: 50 }, (_, i) => seedForLevel(i + 1)));
    expect(seeds.size).toBe(50);
  });
});
