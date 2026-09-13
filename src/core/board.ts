import type { ColorId } from './palette';

/**
 * A board is a grid of cells, and every cell is a *stack* of color
 * layers. `stack[stack.length - 1]` is the top layer — the color the
 * player sees. An empty stack is a hole: it shows the background and
 * breaks connectivity between its neighbours.
 */
export interface Board {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, `cols * rows` entries. Index with `idx()`. */
  readonly cells: readonly (readonly ColorId[])[];
}

/** A region must contain at least this many cells to be peelable. */
export const MIN_REGION = 2;

export function idx(board: Pick<Board, 'cols'>, x: number, y: number): number {
  return y * board.cols + x;
}

export function coords(board: Pick<Board, 'cols'>, i: number): { x: number; y: number } {
  return { x: i % board.cols, y: Math.floor(i / board.cols) };
}

export function cellCount(board: Pick<Board, 'cols' | 'rows'>): number {
  return board.cols * board.rows;
}

export function createEmptyBoard(cols: number, rows: number): Board {
  if (cols <= 0 || rows <= 0) throw new Error('createEmptyBoard: dimensions must be positive');
  return {
    cols,
    rows,
    cells: Array.from({ length: cols * rows }, () => [] as ColorId[]),
  };
}

/** Deep-copies the stacks so the clone can be mutated independently. */
export function cloneBoard(board: Board): Board {
  return {
    cols: board.cols,
    rows: board.rows,
    cells: board.cells.map((stack) => stack.slice()),
  };
}

function stackAt(board: Board, i: number): readonly ColorId[] {
  const stack = board.cells[i];
  if (!stack) throw new Error(`board: index ${i} out of range`);
  return stack;
}

/** The visible color of a cell, or `null` if the cell is a hole. */
export function topColor(board: Board, i: number): ColorId | null {
  const stack = stackAt(board, i);
  return stack.length === 0 ? null : (stack[stack.length - 1] as ColorId);
}

/** How many layers remain in a cell. */
export function depthAt(board: Board, i: number): number {
  return stackAt(board, i).length;
}

/** Total layers left across the whole board. */
export function remainingLayers(board: Board): number {
  let total = 0;
  for (const stack of board.cells) total += stack.length;
  return total;
}

export function isCleared(board: Board): boolean {
  return remainingLayers(board) === 0;
}

/** Indices of the up-to-four orthogonal neighbours of `i`. */
export function neighbors(board: Board, i: number): number[] {
  const { x, y } = coords(board, i);
  const out: number[] = [];
  if (y > 0) out.push(i - board.cols);
  if (y < board.rows - 1) out.push(i + board.cols);
  if (x > 0) out.push(i - 1);
  if (x < board.cols - 1) out.push(i + 1);
  return out;
}

/**
 * The maximal 4-connected set of cells reachable from `i` whose top
 * layers all share `i`'s top color. Returns `[]` for a hole.
 *
 * This is the set a tap would peel, so it doubles as the hit-test for
 * input and the move enumerator for the solver.
 */
export function regionAt(board: Board, i: number): number[] {
  const color = topColor(board, i);
  if (color === null) return [];

  const seen = new Uint8Array(cellCount(board));
  const region: number[] = [];
  const stack: number[] = [i];
  seen[i] = 1;

  while (stack.length > 0) {
    const cur = stack.pop() as number;
    region.push(cur);
    for (const n of neighbors(board, cur)) {
      if (seen[n] === 1) continue;
      if (topColor(board, n) !== color) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }

  return region;
}

export interface PeelResult {
  /** Board state after the peel. The input board is left untouched. */
  board: Board;
  /** Cells whose top layer was removed. */
  peeled: readonly number[];
  /** The color that was removed. */
  color: ColorId;
}

/**
 * Removes the top layer from every cell in the region containing `i`.
 * Returns `null` when the tap is not a legal move (a hole, or a region
 * smaller than {@link MIN_REGION}), so callers can treat `null` as
 * "ignore this tap".
 */
export function peel(board: Board, i: number): PeelResult | null {
  const color = topColor(board, i);
  if (color === null) return null;

  const region = regionAt(board, i);
  if (region.length < MIN_REGION) return null;

  const next = cloneBoard(board);
  const cells = next.cells as ColorId[][];
  for (const cell of region) {
    (cells[cell] as ColorId[]).pop();
  }

  return { board: next, peeled: region, color };
}

/**
 * One representative cell index per distinct legal move. Used to detect
 * dead boards and by the generator's verification pass.
 */
export function findMoves(board: Board): number[] {
  const visited = new Uint8Array(cellCount(board));
  const moves: number[] = [];

  for (let i = 0; i < board.cells.length; i++) {
    if (visited[i] === 1) continue;
    if (topColor(board, i) === null) {
      visited[i] = 1;
      continue;
    }
    const region = regionAt(board, i);
    for (const cell of region) visited[cell] = 1;
    if (region.length >= MIN_REGION) moves.push(i);
  }

  return moves;
}

export function hasMoves(board: Board): boolean {
  return findMoves(board).length > 0;
}

/** Pushes a layer onto a cell. Mutating; used only by the generator. */
export function pushLayer(board: Board, i: number, color: ColorId): void {
  const stack = board.cells[i];
  if (!stack) throw new Error(`pushLayer: index ${i} out of range`);
  (stack as ColorId[]).push(color);
}
