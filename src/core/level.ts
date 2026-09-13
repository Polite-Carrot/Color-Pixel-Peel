import {
  type Board,
  MIN_REGION,
  cellCount,
  createEmptyBoard,
  depthAt,
  neighbors,
  peel,
  pushLayer,
  topColor,
  isCleared,
} from './board';
import { MAX_COLORS, type ColorId } from './palette';
import { type Rng, createRng } from './rng';

export interface LevelConfig {
  cols: number;
  rows: number;
  /** How many palette entries are in play (uses PALETTE[0..colors-1]). */
  colors: number;
  /** Lower bound on the length of the generated solution. */
  targetMoves: number;
  /** Largest region a single stamp may cover. */
  maxStamp: number;
}

export interface Level {
  /** 1-based level number. */
  index: number;
  seed: number;
  config: LevelConfig;
  /** The starting board. */
  board: Board;
  /**
   * Cell indices which, tapped in this order from `board`, clear it
   * completely. Produced by construction, then verified.
   */
  solution: readonly number[];
  /** `solution.length` plus slack, so imperfect play can still win. */
  moveLimit: number;
}

/** Difficulty curve. Grows the grid, the palette and the solution length. */
export function levelConfig(index: number): LevelConfig {
  const n = Math.max(1, Math.trunc(index)) - 1;
  return {
    // Rows grow faster than columns: a phone screen is tall, and a
    // portrait grid fills it without shrinking the touch targets.
    cols: Math.min(4 + Math.floor(n / 4), 8),
    rows: Math.min(5 + Math.floor(n / 2), 11),
    colors: Math.min(3 + Math.floor(n / 4), Math.min(6, MAX_COLORS)),
    targetMoves: 6 + n * 2,
    maxStamp: Math.min(4 + Math.floor(n / 4), 7),
  };
}

/**
 * Grows a 4-connected blob of up to `size` cells by random walk. Cells
 * that are still holes are favoured, which is what drives the board
 * towards full coverage.
 */
function growStamp(board: Board, rng: Rng, size: number): number[] {
  const total = cellCount(board);
  const uncovered: number[] = [];
  for (let i = 0; i < total; i++) if (depthAt(board, i) === 0) uncovered.push(i);

  const start = uncovered.length > 0 ? rng.pick(uncovered) : rng.int(total);

  const inStamp = new Uint8Array(total);
  const stamp: number[] = [start];
  inStamp[start] = 1;

  let frontier = neighbors(board, start);

  while (stamp.length < size && frontier.length > 0) {
    // Prefer extending into holes so coverage completes, but not always:
    // the occasional overlap is what creates depth.
    const holes = frontier.filter((i) => depthAt(board, i) === 0);
    const pool = holes.length > 0 && rng.next() < 0.75 ? holes : frontier;
    const chosen = rng.pick(pool);

    inStamp[chosen] = 1;
    stamp.push(chosen);

    frontier = frontier.filter((i) => inStamp[i] !== 1);
    for (const n of neighbors(board, chosen)) {
      if (inStamp[n] !== 1 && !frontier.includes(n)) frontier.push(n);
    }
  }

  return stamp;
}

/**
 * Picks a color for a stamp such that the stamp becomes a *maximal*
 * same-color region.
 *
 * This is the invariant the whole generator rests on: if no cell
 * bordering the stamp already shows the chosen color, then a tap
 * anywhere in the stamp peels exactly the stamp — never more. That makes
 * the reverse of the stamp order a legal forward solution.
 *
 * Returns `null` when every available color would merge the stamp with a
 * neighbour, in which case the caller retries with a different shape.
 */
function chooseColor(board: Board, stamp: readonly number[], colors: number, rng: Rng): ColorId | null {
  const inStamp = new Set(stamp);

  // Colors that would merge the stamp with an adjacent region.
  const blocked = new Set<ColorId>();
  // Colors already on top inside the stamp: legal, but a peel that
  // reveals the same color again reads as a no-op, so avoid when we can.
  const dull = new Set<ColorId>();

  for (const cell of stamp) {
    const own = topColor(board, cell);
    if (own !== null) dull.add(own);
    for (const n of neighbors(board, cell)) {
      if (inStamp.has(n)) continue;
      const c = topColor(board, n);
      if (c !== null) blocked.add(c);
    }
  }

  const allowed: ColorId[] = [];
  const preferred: ColorId[] = [];
  for (let c = 0; c < colors; c++) {
    if (blocked.has(c)) continue;
    allowed.push(c);
    if (!dull.has(c)) preferred.push(c);
  }

  if (preferred.length > 0) return rng.pick(preferred);
  if (allowed.length > 0) return rng.pick(allowed);
  return null;
}

/** Replays `moves` against `board` and reports whether they clear it. */
export function verifySolution(board: Board, moves: readonly number[]): boolean {
  let current = board;
  for (const move of moves) {
    const result = peel(current, move);
    if (!result) return false;
    current = result.board;
  }
  return isCleared(current);
}

const STAMP_BUDGET = 6000;

/**
 * Builds a level by reverse-peeling: start from an empty board and stamp
 * maximal color regions onto it. Playing the stamps back in reverse order
 * peels every layer off again, so the level is solvable by construction —
 * `verifySolution` then re-checks that before the level is handed out.
 */
export function generateLevel(index: number, seed: number, configOverride?: Partial<LevelConfig>): Level {
  const config: LevelConfig = { ...levelConfig(index), ...configOverride };
  if (config.colors < 2) throw new Error('generateLevel: need at least 2 colors');
  if (config.maxStamp < MIN_REGION) throw new Error(`generateLevel: maxStamp must be >= ${MIN_REGION}`);

  const rng = createRng(seed);
  const board = createEmptyBoard(config.cols, config.rows);
  const total = cellCount(board);

  /** Stamp order; `stamps[j]` is a representative cell of stamp j. */
  const stamps: number[] = [];

  const uncoveredCount = (): number => {
    let n = 0;
    for (let i = 0; i < total; i++) if (depthAt(board, i) === 0) n++;
    return n;
  };

  for (let attempt = 0; attempt < STAMP_BUDGET; attempt++) {
    const covered = uncoveredCount() === 0;
    if (covered && stamps.length >= config.targetMoves) break;

    const size = MIN_REGION + rng.int(config.maxStamp - MIN_REGION + 1);
    const stamp = growStamp(board, rng, size);
    if (stamp.length < MIN_REGION) continue;

    const color = chooseColor(board, stamp, config.colors, rng);
    if (color === null) continue;

    for (const cell of stamp) pushLayer(board, cell, color);
    // Any cell of the stamp works as the tap target; they are one region.
    stamps.push(stamp[0] as number);
  }

  if (stamps.length === 0) throw new Error('generateLevel: could not place any stamp');

  // Peeling in reverse of the stamp order undoes every push.
  const solution = stamps.slice().reverse();

  if (!verifySolution(board, solution)) {
    // The construction proves this unreachable; kept so a future change
    // to the generator fails loudly instead of shipping a dead level.
    throw new Error(`generateLevel: constructed solution failed verification (level ${index}, seed ${seed})`);
  }

  const slack = Math.max(2, Math.ceil(solution.length * 0.35));

  return {
    index,
    seed,
    config,
    board,
    solution,
    moveLimit: solution.length + slack,
  };
}

/**
 * Stable seed for a level, so level N is the same board every time the
 * player reaches it (and the same for everyone).
 */
export function seedForLevel(index: number, salt = 0x9e3779b9): number {
  return (Math.imul(index, 0x85ebca6b) ^ salt) >>> 0;
}
