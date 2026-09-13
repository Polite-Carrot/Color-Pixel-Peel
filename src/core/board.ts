import type { ColorId } from './palette';
import { type PictureSource, parsePicture } from './picture';

/**
 * The picture as the player works on it: a flat grid of tiles, one color
 * each. `null` is background — either never part of the artwork, or
 * already cleared.
 *
 * There are no layer stacks. The artwork has to stay readable, and
 * anything stacked on top of it would hide the thing the player is
 * uncovering.
 */
export interface Board {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, `cols * rows` entries. Index with `idx()`. */
  readonly tiles: readonly (ColorId | null)[];
}

export function idx(board: Pick<Board, 'cols'>, x: number, y: number): number {
  return y * board.cols + x;
}

export function coords(board: Pick<Board, 'cols'>, i: number): { x: number; y: number } {
  return { x: i % board.cols, y: Math.floor(i / board.cols) };
}

export function cellCount(board: Pick<Board, 'cols' | 'rows'>): number {
  return board.cols * board.rows;
}

export function boardFromPicture(source: PictureSource): Board {
  const picture = parsePicture(source);
  return { cols: picture.cols, rows: picture.rows, tiles: picture.tiles };
}

export function tileAt(board: Board, i: number): ColorId | null {
  if (i < 0 || i >= board.tiles.length) throw new Error(`board: index ${i} out of range`);
  return board.tiles[i] as ColorId | null;
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
 * A tile is **accessible** when it can be reached from outside the
 * artwork: it touches background on at least one side, or sits on the
 * board's edge.
 *
 * So at the start only the picture's outline can be taken, and clearing
 * it opens the way inward. That is what stops a level being a flat
 * shopping list of colors — the order you open the picture up in decides
 * what you can reach next.
 */
export function isAccessible(board: Board, i: number): boolean {
  if (tileAt(board, i) === null) return false;

  const { x, y } = coords(board, i);
  // The board edge counts as open, or a picture filling its whole
  // rectangle would have nothing accessible at all.
  if (x === 0 || y === 0 || x === board.cols - 1 || y === board.rows - 1) return true;

  return neighbors(board, i).some((n) => tileAt(board, n) === null);
}

/** Every accessible tile, in row-major order. */
export function accessibleTiles(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.tiles.length; i++) {
    if (isAccessible(board, i)) out.push(i);
  }
  return out;
}

/** Every accessible tile of one color, in row-major order. */
export function accessibleOf(board: Board, color: ColorId): number[] {
  return accessibleTiles(board).filter((i) => tileAt(board, i) === color);
}

/** How many tiles of a color remain, reachable or not. */
export function remainingOf(board: Board, color: ColorId): number {
  let n = 0;
  for (const tile of board.tiles) if (tile === color) n++;
  return n;
}

export function remainingTiles(board: Board): number {
  let n = 0;
  for (const tile of board.tiles) if (tile !== null) n++;
  return n;
}

export function isCleared(board: Board): boolean {
  return remainingTiles(board) === 0;
}

/** Colors still on the board, lowest id first. */
export function remainingColors(board: Board): ColorId[] {
  const seen = new Set<ColorId>();
  for (const tile of board.tiles) if (tile !== null) seen.add(tile);
  return [...seen].sort((a, b) => a - b);
}

export interface TakeResult {
  /** Board with the tiles removed. The input is left untouched. */
  board: Board;
  /** Which tiles went, in the order they were taken. */
  taken: readonly number[];
}

/**
 * Takes up to `count` accessible tiles of `color`.
 *
 * When more are reachable than asked for, the ones nearest the top-left
 * go first. That is deliberate rather than clever: the player is spending
 * a number, not choosing tiles, so the rule only has to be consistent and
 * easy to predict.
 */
export function takeColor(board: Board, color: ColorId, count: number): TakeResult {
  if (count <= 0) return { board, taken: [] };

  const taken = accessibleOf(board, color).slice(0, count);
  if (taken.length === 0) return { board, taken: [] };

  const tiles = board.tiles.slice();
  for (const i of taken) tiles[i] = null;

  return { board: { cols: board.cols, rows: board.rows, tiles }, taken };
}
