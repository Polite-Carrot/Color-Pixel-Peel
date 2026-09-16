import { describe, expect, it } from 'vitest';
import { block, blockTotals, dealColumns, frontBlocks, remainingBlocks } from './blocks';
import { LEVEL_COUNT, levelDef } from './levels';
import { BLUE, DARK, RED, YELLOW } from './palette';

describe('blocks', () => {
  it('refuses a count that takes nothing', () => {
    expect(() => block(RED, 0)).toThrow();
    expect(() => block(RED, -2)).toThrow();
  });

  it('totals by color', () => {
    const totals = blockTotals([block(RED, 3), block(BLUE, 2), block(RED, 4)]);
    expect(totals.get(RED)).toBe(7);
    expect(totals.get(BLUE)).toBe(2);
  });
});

describe('dealing into columns', () => {
  const hand = [
    ...Array.from({ length: 6 }, () => block(DARK, 8)),
    ...Array.from({ length: 6 }, () => block(RED, 5)),
    ...Array.from({ length: 3 }, () => block(YELLOW, 4)),
  ];

  it('keeps every block, and only those blocks', () => {
    const dealt = dealColumns(hand, 3, 99);
    expect(remainingBlocks(dealt)).toHaveLength(hand.length);
    expect(blockTotals(remainingBlocks(dealt))).toEqual(blockTotals(hand));
  });

  it('deals the same hand for the same seed', () => {
    expect(dealColumns(hand, 3, 7)).toEqual(dealColumns(hand, 3, 7));
  });

  it('deals differently for a different seed', () => {
    expect(dealColumns(hand, 3, 7)).not.toEqual(dealColumns(hand, 3, 8));
  });

  it('fills the columns evenly', () => {
    const dealt = dealColumns(hand, 4, 3);
    const sizes = dealt.map((c) => c.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('refuses a column count of zero', () => {
    expect(() => dealColumns(hand, 0)).toThrow(/at least one column/);
  });

  it('reports the front of each column, and nulls once spent', () => {
    const dealt = dealColumns(hand, 3, 1);
    expect(frontBlocks(dealt)).toHaveLength(3);
    expect(frontBlocks([[], [block(RED, 2)]])).toEqual([null, { color: RED, count: 2 }]);
  });

  /* The reason the deal is shuffled at all: dealt in written order, runs
     of one color landed in one column, and a column of nothing but dark
     does nothing whenever dark is buried. */
  it('never leaves a column holding only one color', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const columns of [3, 4, 5]) {
        const dealt = dealColumns(hand, columns, seed);
        for (const [i, column] of dealt.entries()) {
          if (column.length < 2) continue;
          const colors = new Set(column.map((b) => b.color));
          expect(colors.size, `seed ${seed}, ${columns} columns, column ${i} is one color`).toBeGreaterThan(1);
        }
      }
    }
  });

  it('mixes the real levels rather than stacking a color', () => {
    for (let i = 1; i <= LEVEL_COUNT; i += 7) {
      const def = levelDef(i);
      const dealt = dealColumns(def.blocks, def.columns, def.seed);
      for (const [c, column] of dealt.entries()) {
        if (column.length < 2) continue;
        const colors = new Set(column.map((b) => b.color));
        expect(colors.size, `level ${i} (${def.name}) column ${c} is one color`).toBeGreaterThan(1);
      }
    }
  });

  it('falls back to a plain deal when a hand cannot be mixed', () => {
    // One color is all there is, so no shuffle can help — it must still
    // deal rather than loop looking for the impossible.
    const single = [block(RED, 2), block(RED, 3), block(RED, 4)];
    const dealt = dealColumns(single, 2, 5);
    expect(remainingBlocks(dealt)).toHaveLength(3);
  });
});
