import { describe, expect, it } from 'vitest';
import {
  accessibleOf,
  accessibleTiles,
  boardFromPicture,
  cellCount,
  coords,
  idx,
  isAccessible,
  isCleared,
  neighbors,
  remainingColors,
  remainingOf,
  remainingTiles,
  takeColor,
  tileAt,
} from './board';
import { BLUE, RED, WHITE } from './palette';

const legend = { R: RED, B: BLUE, W: WHITE };

describe('board geometry', () => {
  it('round-trips index and coordinates', () => {
    const board = boardFromPicture({ rows: ['RRRRR', 'RRRRR', 'RRRRR'], legend });
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 5; x++) {
        expect(coords(board, idx(board, x, y))).toEqual({ x, y });
      }
    }
    expect(cellCount(board)).toBe(15);
  });

  it('lists only orthogonal neighbours, clipped at edges', () => {
    const board = boardFromPicture({ rows: ['RRR', 'RRR', 'RRR'], legend });
    expect(neighbors(board, idx(board, 1, 1)).sort((a, b) => a - b)).toEqual([1, 3, 5, 7]);
    expect(neighbors(board, 0)).toHaveLength(2);
  });

  it('throws on an out-of-range index', () => {
    const board = boardFromPicture({ rows: ['RR'], legend });
    expect(() => tileAt(board, 99)).toThrow();
  });
});

describe('the picture', () => {
  it('reads background as no tile at all', () => {
    const board = boardFromPicture({ rows: ['.R.', 'RRR'], legend });
    expect(tileAt(board, 0)).toBeNull();
    expect(tileAt(board, 1)).toBe(RED);
    expect(remainingTiles(board)).toBe(4);
  });

  it('counts what is left, by color and in total', () => {
    const board = boardFromPicture({ rows: ['RRB', 'WWB'], legend });
    expect(remainingOf(board, RED)).toBe(2);
    expect(remainingOf(board, BLUE)).toBe(2);
    expect(remainingColors(board)).toEqual([RED, BLUE, WHITE].sort((a, b) => a - b));
    expect(isCleared(board)).toBe(false);
  });
});

describe('accessibility', () => {
  it('counts the board edge as open', () => {
    // A solid rectangle: the whole border is reachable, the middle is not.
    const board = boardFromPicture({ rows: ['RRR', 'RRR', 'RRR'], legend });
    expect(isAccessible(board, idx(board, 1, 1))).toBe(false);
    expect(isAccessible(board, idx(board, 0, 0))).toBe(true);
    expect(isAccessible(board, idx(board, 1, 0))).toBe(true);
    expect(accessibleTiles(board)).toHaveLength(8);
  });

  it('opens a tile up once a neighbour is cleared', () => {
    const board = boardFromPicture({ rows: ['RRR', 'RBR', 'RRR'], legend });
    const middle = idx(board, 1, 1);
    expect(isAccessible(board, middle)).toBe(false);

    // Reds come off top-left first, so two of them clears (0,0) and the
    // (1,0) directly above the middle — which is what opens it.
    const result = takeColor(board, RED, 2);
    expect(result.taken).toContain(idx(board, 1, 0));
    expect(isAccessible(result.board, middle)).toBe(true);
  });

  it('treats background inside the picture as an opening', () => {
    const board = boardFromPicture({ rows: ['RRRRR', 'RR.RR', 'RRRRR'], legend });
    // Neighbours of the hole are reachable even though they are interior.
    expect(isAccessible(board, idx(board, 2, 0))).toBe(true);
    expect(isAccessible(board, idx(board, 1, 1))).toBe(true);
  });

  it('never counts a cleared tile as accessible', () => {
    const board = boardFromPicture({ rows: ['.R'], legend });
    expect(isAccessible(board, 0)).toBe(false);
  });

  it('filters by color', () => {
    const board = boardFromPicture({ rows: ['RB', 'BR'], legend });
    expect(accessibleOf(board, RED)).toEqual([0, 3]);
    expect(accessibleOf(board, BLUE)).toEqual([1, 2]);
  });
});

describe('takeColor', () => {
  it('takes up to the count asked for', () => {
    const board = boardFromPicture({ rows: ['RRRR'], legend });
    const result = takeColor(board, RED, 3);
    expect(result.taken).toHaveLength(3);
    expect(remainingOf(result.board, RED)).toBe(1);
  });

  it('takes only what is reachable, not what is asked for', () => {
    // Only the border reds are reachable; the centre is walled in.
    const board = boardFromPicture({ rows: ['BBB', 'BRB', 'BBB'], legend });
    const result = takeColor(board, RED, 5);
    expect(result.taken).toHaveLength(0);
    expect(remainingOf(result.board, RED)).toBe(1);
  });

  it('leaves the input board untouched', () => {
    const board = boardFromPicture({ rows: ['RRRR'], legend });
    takeColor(board, RED, 2);
    expect(remainingOf(board, RED)).toBe(4);
  });

  it('takes from the top-left first, so the rule is predictable', () => {
    const board = boardFromPicture({ rows: ['RRR', 'RRR'], legend });
    expect(takeColor(board, RED, 2).taken).toEqual([0, 1]);
  });

  it('does nothing for a count of zero or less', () => {
    const board = boardFromPicture({ rows: ['RR'], legend });
    expect(takeColor(board, RED, 0).taken).toEqual([]);
    expect(takeColor(board, RED, -3).taken).toEqual([]);
  });

  it('clears the picture when the last tiles go', () => {
    const board = boardFromPicture({ rows: ['RR'], legend });
    expect(isCleared(takeColor(board, RED, 2).board)).toBe(true);
  });
});
