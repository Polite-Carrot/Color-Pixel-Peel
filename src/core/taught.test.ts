import { describe, expect, it } from 'vitest';
import { MIN_REGION, depthAt, cellCount, isCleared, peel, regionAt } from './board';
import { levelConfig, levelFor, taughtLevel, verifySolution } from './level';
import { TAUGHT, TAUGHT_COUNT } from './taught';
import { MAX_COLORS } from './palette';

describe('hand-authored levels', () => {
  it('has at least one', () => {
    expect(TAUGHT_COUNT).toBeGreaterThan(0);
    expect(TAUGHT).toHaveLength(TAUGHT_COUNT);
  });

  // Loops over the table, so adding a level cannot skip these checks.
  it.each(TAUGHT.map((_, i) => i + 1))('level %i ships a solution that clears it', (index) => {
    const level = taughtLevel(index);
    expect(verifySolution(level.board, level.solution)).toBe(true);
    expect(level.solution.length).toBeLessThanOrEqual(level.moveLimit);
    expect(level.taught).toBe(true);
  });

  it.each(TAUGHT.map((_, i) => i + 1))('level %i says what it teaches', (index) => {
    const level = taughtLevel(index);
    expect(level.brief).toBeTruthy();
    expect((level.brief as string).length).toBeGreaterThan(20);
    // Player-facing copy, so US spelling.
    expect(level.brief).not.toMatch(/colour/);
  });

  it.each(TAUGHT.map((_, i) => i + 1))('level %i starts with no holes', (index) => {
    const level = taughtLevel(index);
    for (let i = 0; i < cellCount(level.board); i++) {
      expect(depthAt(level.board, i)).toBeGreaterThan(0);
    }
  });

  it.each(TAUGHT.map((_, i) => i + 1))('level %i only uses real colors', (index) => {
    const level = taughtLevel(index);
    for (const stack of level.board.cells) {
      for (const color of stack) {
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThan(MAX_COLORS);
        expect(color).toBeLessThan(level.config.colors);
      }
    }
  });

  it('builds the same board every time', () => {
    expect(taughtLevel(1).board).toEqual(taughtLevel(1).board);
  });

  it('rejects a level number it does not have', () => {
    expect(() => taughtLevel(0)).toThrow(/no hand-authored level/);
    expect(() => taughtLevel(TAUGHT_COUNT + 1)).toThrow(/no hand-authored level/);
  });
});

describe('level 1 teaches the minimum run', () => {
  it('opens with a peel of exactly the smallest legal run', () => {
    const level = taughtLevel(1);
    const first = level.solution[0] as number;
    expect(regionAt(level.board, first)).toHaveLength(MIN_REGION);
  });

  it('pays that off with bigger sweeps later', () => {
    // The small peels tidy the board into runs the last moves clear four
    // at a time — the shape of the lesson, not just its content.
    const level = taughtLevel(1);
    let board = level.board;
    const sizes: number[] = [];
    for (const move of level.solution) {
      const result = peel(board, move);
      expect(result).not.toBeNull();
      sizes.push(result!.peeled.length);
      board = result!.board;
    }
    expect(isCleared(board)).toBe(true);
    expect(Math.max(...sizes)).toBeGreaterThan(MIN_REGION);
    expect(sizes[sizes.length - 1]).toBeGreaterThan(sizes[0] as number);
  });

  it('is gentler than the first dealt level', () => {
    const taught = taughtLevel(1);
    const dealt = levelFor(TAUGHT_COUNT + 1);
    expect(cellCount(taught.board)).toBeLessThan(cellCount(dealt.board));
    expect(taught.solution.length).toBeLessThan(dealt.solution.length);
  });
});

describe('levelFor', () => {
  it('serves the hand-authored levels first', () => {
    for (let i = 1; i <= TAUGHT_COUNT; i++) {
      expect(levelFor(i).taught).toBe(true);
      expect(levelFor(i).index).toBe(i);
    }
  });

  it('deals every level after them', () => {
    const first = levelFor(TAUGHT_COUNT + 1);
    expect(first.taught).toBeUndefined();
    expect(first.brief).toBeUndefined();
    expect(first.index).toBe(TAUGHT_COUNT + 1);
  });

  it('starts the ladder at its own first rung, so no step is skipped', () => {
    // Putting a taught level in front must not cost the dealt curve its
    // easiest board.
    expect(levelFor(TAUGHT_COUNT + 1).config).toEqual(levelConfig(1));
    expect(levelFor(TAUGHT_COUNT + 2).config).toEqual(levelConfig(2));
  });

  it('keeps dealing solvable levels past the authored ones', () => {
    for (let i = TAUGHT_COUNT + 1; i <= TAUGHT_COUNT + 12; i++) {
      const level = levelFor(i);
      expect(verifySolution(level.board, level.solution), `level ${i} unsolvable`).toBe(true);
    }
  });
});
