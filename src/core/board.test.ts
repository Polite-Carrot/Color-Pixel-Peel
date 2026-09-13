import { describe, expect, it } from 'vitest';
import {
  MIN_REGION,
  cloneBoard,
  coords,
  createEmptyBoard,
  depthAt,
  findMoves,
  hasMoves,
  idx,
  isCleared,
  neighbors,
  peel,
  regionAt,
  remainingLayers,
  topColor,
} from './board';
import { boardFrom } from './test-helpers';

describe('board geometry', () => {
  it('round-trips index and coordinates', () => {
    const board = createEmptyBoard(5, 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 5; x++) {
        expect(coords(board, idx(board, x, y))).toEqual({ x, y });
      }
    }
  });

  it('starts empty and therefore cleared', () => {
    const board = createEmptyBoard(3, 3);
    expect(board.cells).toHaveLength(9);
    expect(remainingLayers(board)).toBe(0);
    expect(isCleared(board)).toBe(true);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => createEmptyBoard(0, 3)).toThrow();
    expect(() => createEmptyBoard(3, -1)).toThrow();
  });

  it('lists only orthogonal neighbours, clipped at edges', () => {
    const board = createEmptyBoard(3, 3);
    expect(neighbors(board, idx(board, 1, 1)).sort()).toEqual([1, 3, 5, 7]);
    // A corner has exactly two.
    expect(neighbors(board, idx(board, 0, 0))).toHaveLength(2);
  });
});

describe('layer stacks', () => {
  it('reads the top layer as the visible color', () => {
    const board = boardFrom([['01'], ['2.']]);
    expect(topColor(board, 0)).toBe(2);
    expect(depthAt(board, 0)).toBe(2);
    expect(topColor(board, 1)).toBe(1);
    expect(depthAt(board, 1)).toBe(1);
  });

  it('reports an empty stack as a hole', () => {
    const board = boardFrom([['.0']]);
    expect(topColor(board, 0)).toBeNull();
    expect(depthAt(board, 0)).toBe(0);
  });

  it('clones deeply so the copy can be mutated independently', () => {
    const board = boardFrom([['00', '00']]);
    const copy = cloneBoard(board);
    (copy.cells[0] as number[]).pop();
    expect(depthAt(copy, 0)).toBe(0);
    expect(depthAt(board, 0)).toBe(1);
  });

  it('throws on an out-of-range index', () => {
    const board = createEmptyBoard(2, 2);
    expect(() => topColor(board, 99)).toThrow();
  });
});

describe('regionAt', () => {
  it('collects the connected run of one color', () => {
    const board = boardFrom([['001', '001', '111']]);
    expect(regionAt(board, 0).sort((a, b) => a - b)).toEqual([0, 1, 3, 4]);
  });

  it('does not connect diagonally', () => {
    const board = boardFrom([['01', '10']]);
    expect(regionAt(board, 0)).toEqual([0]);
  });

  it('is empty for a hole', () => {
    const board = boardFrom([['.0']]);
    expect(regionAt(board, 0)).toEqual([]);
  });

  it('treats holes as walls between same-colored cells', () => {
    const board = boardFrom([['0.0']]);
    expect(regionAt(board, 0)).toEqual([0]);
    expect(regionAt(board, 2)).toEqual([2]);
  });

  it('returns the same region from any member cell', () => {
    const board = boardFrom([['00', '00']]);
    const fromFirst = regionAt(board, 0).sort((a, b) => a - b);
    const fromLast = regionAt(board, 3).sort((a, b) => a - b);
    expect(fromFirst).toEqual(fromLast);
    expect(fromFirst).toEqual([0, 1, 2, 3]);
  });
});

describe('peel', () => {
  it('removes exactly one layer from every cell of the region', () => {
    const board = boardFrom([
      ['00', '00'],
      ['11', '1.'],
    ]);
    // Tops are 1,1,1,0 — the three 1s form the region.
    const result = peel(board, 0);
    expect(result).not.toBeNull();
    const { board: next, peeled, color } = result!;
    expect(color).toBe(1);
    expect([...peeled].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(topColor(next, 0)).toBe(0);
    expect(depthAt(next, 0)).toBe(1);
    // The untouched cell keeps its layer.
    expect(depthAt(next, 3)).toBe(1);
  });

  it('leaves the input board untouched', () => {
    const board = boardFrom([['00']]);
    const before = remainingLayers(board);
    peel(board, 0);
    expect(remainingLayers(board)).toBe(before);
    expect(topColor(board, 0)).toBe(0);
  });

  it('turns a one-layer region into holes', () => {
    const board = boardFrom([['00']]);
    const next = peel(board, 0)!.board;
    expect(isCleared(next)).toBe(true);
    expect(topColor(next, 0)).toBeNull();
  });

  it('refuses a region smaller than the minimum', () => {
    const board = boardFrom([['01']]);
    expect(MIN_REGION).toBe(2);
    expect(peel(board, 0)).toBeNull();
    expect(peel(board, 1)).toBeNull();
  });

  it('refuses a hole', () => {
    const board = boardFrom([['.0', '00']]);
    expect(peel(board, 0)).toBeNull();
  });
});

describe('move enumeration', () => {
  it('reports one move per distinct region, not per cell', () => {
    // Two separate 2-cell regions of color 0 and one of color 1.
    const board = boardFrom([['001', '001', '111']]);
    const moves = findMoves(board);
    expect(moves).toHaveLength(2);
    // The representatives must come from different regions.
    const regions = moves.map((m) => new Set(regionAt(board, m)));
    expect(regions[0]!.size + regions[1]!.size).toBe(9);
  });

  it('finds no moves when every region is a single cell', () => {
    const board = boardFrom([['01', '10']]);
    expect(findMoves(board)).toEqual([]);
    expect(hasMoves(board)).toBe(false);
  });

  it('finds no moves on an empty board', () => {
    expect(hasMoves(createEmptyBoard(4, 4))).toBe(false);
  });

  it('ignores single cells but keeps the legal region', () => {
    const board = boardFrom([['001']]);
    expect(findMoves(board)).toHaveLength(1);
    expect(regionAt(board, findMoves(board)[0]!)).toHaveLength(2);
  });
});
