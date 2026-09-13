import { type Board, hasMoves, isCleared, peel } from './board';
import { type Level, levelFor } from './level';
import type { ColorId } from './palette';

export type GameStatus = 'playing' | 'won' | 'lost';
export type LossReason = 'out-of-moves' | 'no-moves';

/** Points for peeling a region of `size` cells. Quadratic, so chaining
 *  a big region is worth far more than several small ones. */
export function regionScore(size: number): number {
  return 5 * size * size;
}

/** Bonus for clearing a board, rewarding unused moves. */
export function clearBonus(movesLeft: number): number {
  return 250 + movesLeft * 50;
}

export type TapOutcome =
  | { kind: 'ignored' }
  | {
      kind: 'peeled';
      peeled: readonly number[];
      color: ColorId;
      points: number;
      /** Status *after* the peel resolved. */
      status: GameStatus;
      lossReason?: LossReason;
      /** Bonus awarded if this peel cleared the board. */
      bonus?: number;
    };

interface Snapshot {
  board: Board;
  movesUsed: number;
  levelScore: number;
  totalScore: number;
}

const HISTORY_LIMIT = 64;

/**
 * Owns all mutable game state. Deliberately free of DOM and rendering
 * concerns so the rules can be tested headlessly.
 */
export class Game {
  private _level: Level;
  private _board: Board;
  private _movesUsed = 0;
  private _levelScore = 0;
  private _totalScore = 0;
  private _status: GameStatus = 'playing';
  private _lossReason: LossReason | undefined;
  private _history: Snapshot[] = [];

  /**
   * `start` is either a level number (resolved through {@link levelFor},
   * so hand-authored levels come first) or a ready-made {@link Level},
   * which lets tests and a future level-select screen drive the game
   * without rebuilding.
   */
  constructor(start: number | Level = 1, carriedScore = 0) {
    this._level = typeof start === 'number' ? levelFor(start) : start;
    this._board = this._level.board;
    this._totalScore = carriedScore;
  }

  get level(): Level {
    return this._level;
  }
  get board(): Board {
    return this._board;
  }
  get levelIndex(): number {
    return this._level.index;
  }
  get movesUsed(): number {
    return this._movesUsed;
  }
  get movesLeft(): number {
    return Math.max(0, this._level.moveLimit - this._movesUsed);
  }
  get score(): number {
    return this._totalScore;
  }
  get levelScore(): number {
    return this._levelScore;
  }
  get status(): GameStatus {
    return this._status;
  }
  get lossReason(): LossReason | undefined {
    return this._lossReason;
  }
  get canUndo(): boolean {
    return this._history.length > 0;
  }

  /**
   * Plays a tap on cell `i`. Illegal taps (holes, single-cell regions)
   * and taps after the level has ended are reported as `ignored` so the
   * caller can decide whether to give feedback.
   */
  tap(i: number): TapOutcome {
    if (this._status !== 'playing') return { kind: 'ignored' };

    const result = peel(this._board, i);
    if (!result) return { kind: 'ignored' };

    this.pushHistory();

    this._board = result.board;
    this._movesUsed += 1;

    const points = regionScore(result.peeled.length);
    this._levelScore += points;
    this._totalScore += points;

    let bonus: number | undefined;

    if (isCleared(this._board)) {
      this._status = 'won';
      bonus = clearBonus(this.movesLeft);
      this._levelScore += bonus;
      this._totalScore += bonus;
    } else if (this._movesUsed >= this._level.moveLimit) {
      this._status = 'lost';
      this._lossReason = 'out-of-moves';
    } else if (!hasMoves(this._board)) {
      this._status = 'lost';
      this._lossReason = 'no-moves';
    }

    return {
      kind: 'peeled',
      peeled: result.peeled,
      color: result.color,
      points,
      status: this._status,
      ...(this._lossReason ? { lossReason: this._lossReason } : {}),
      ...(bonus !== undefined ? { bonus } : {}),
    };
  }

  /** Steps back one peel, including out of a lost/won state. */
  undo(): boolean {
    const prev = this._history.pop();
    if (!prev) return false;
    this._board = prev.board;
    this._movesUsed = prev.movesUsed;
    this._levelScore = prev.levelScore;
    this._totalScore = prev.totalScore;
    this._status = 'playing';
    this._lossReason = undefined;
    return true;
  }

  /** Restarts the current level, refunding the score earned inside it. */
  restart(): void {
    this._totalScore -= this._levelScore;
    this._board = this._level.board;
    this._movesUsed = 0;
    this._levelScore = 0;
    this._status = 'playing';
    this._lossReason = undefined;
    this._history = [];
  }

  /** Advances to the next level. Only valid once the current one is won. */
  nextLevel(): void {
    if (this._status !== 'won') return;
    this._level = levelFor(this._level.index + 1);
    this._board = this._level.board;
    this._movesUsed = 0;
    this._levelScore = 0;
    this._status = 'playing';
    this._lossReason = undefined;
    this._history = [];
  }

  private pushHistory(): void {
    this._history.push({
      board: this._board,
      movesUsed: this._movesUsed,
      levelScore: this._levelScore,
      totalScore: this._totalScore,
    });
    if (this._history.length > HISTORY_LIMIT) this._history.shift();
  }
}
