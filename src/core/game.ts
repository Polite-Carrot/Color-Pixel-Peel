import {
  type Board,
  accessibleOf,
  boardFromPicture,
  isCleared,
  remainingTiles,
  takeColor,
} from './board';
import { type Block, dealColumns, frontBlocks, remainingBlocks } from './blocks';
import { type LevelDef, LEVEL_COUNT, levelDef } from './levels';
import type { ColorId } from './palette';

export type GameStatus = 'playing' | 'won' | 'stuck';

/**
 * How long one tile takes. A block of ten counts down 10, 9, 8 over five
 * seconds — this is a rule of the game rather than a flourish, which is
 * why it lives here and not in the renderer.
 */
export const TILE_INTERVAL_MS = 500;

/** Points per tile taken off the picture. */
export const TILE_SCORE = 10;
/** Paid for finishing the picture. */
export const CLEAR_BONUS = 500;

/**
 * A panel slot. A block sits here eating tiles of its color one at a
 * time, and the number shown on it is `remaining` — so a block is a
 * countdown you can watch rather than a thing that vanishes.
 *
 * Every slot runs its own clock, so several blocks drain at once.
 */
export interface Slot {
  block: Block | null;
  /** Tiles still owed. Zero means the block is spent and the slot frees. */
  remaining: number;
  /** When this slot may take its next tile. */
  nextAt: number;
}

export type PlaceOutcome =
  | { kind: 'ignored'; reason: 'no-free-slot' | 'no-such-block' | 'finished' }
  | { kind: 'placed'; slot: number; block: Block };

/** One tile leaving the picture, and which slot spent it. */
export interface TakenTile {
  cell: number;
  color: ColorId;
  slot: number;
}

export interface TickOutcome {
  /** Tiles taken this tick — at most one per draining slot. */
  taken: readonly TakenTile[];
  points: number;
  status: GameStatus;
}

interface Snapshot {
  board: Board;
  columns: Block[][];
  slots: Slot[];
  score: number;
}

const HISTORY_LIMIT = 64;

/**
 * Owns all mutable game state. Free of DOM and rendering, and given the
 * time rather than reading a clock, so the rules can be tested by driving
 * them frame by frame.
 */
export class Game {
  private _def: LevelDef;
  private _index: number;
  private _board: Board;
  private _columns: Block[][];
  private _slots: Slot[];
  private _score = 0;
  private _status: GameStatus = 'playing';
  private _history: Snapshot[] = [];

  constructor(startLevel = 1, carriedScore = 0) {
    this._index = Math.min(Math.max(1, startLevel), LEVEL_COUNT);
    this._def = levelDef(this._index);
    this._board = boardFromPicture(this._def.picture);
    this._columns = dealColumns(this._def.blocks, this._def.columns, this._def.seed);
    this._slots = Game.emptySlots(this._def.slots);
    this._score = carriedScore;
  }

  private static emptySlots(n: number): Slot[] {
    return Array.from({ length: n }, () => ({ block: null, remaining: 0, nextAt: 0 }));
  }

  get level(): LevelDef {
    return this._def;
  }
  get levelIndex(): number {
    return this._index;
  }
  get board(): Board {
    return this._board;
  }
  get columns(): readonly (readonly Block[])[] {
    return this._columns;
  }
  get fronts(): readonly (Block | null)[] {
    return frontBlocks(this._columns);
  }
  get blocksLeft(): readonly Block[] {
    return remainingBlocks(this._columns);
  }
  get slots(): readonly Slot[] {
    return this._slots;
  }
  get score(): number {
    return this._score;
  }
  get status(): GameStatus {
    return this._status;
  }
  get canUndo(): boolean {
    return this._history.length > 0;
  }
  get tilesLeft(): number {
    return remainingTiles(this._board);
  }
  get isLastLevel(): boolean {
    return this._index >= LEVEL_COUNT;
  }

  /** True while any block still owes tiles. */
  get isDraining(): boolean {
    return this._slots.some((s) => s.block !== null && s.remaining > 0);
  }

  get hasFreeSlot(): boolean {
    return this._slots.some((s) => s.block === null);
  }

  /** How many tiles of a color are reachable right now. */
  reachable(color: ColorId): number {
    return accessibleOf(this._board, color).length;
  }

  private freeSlotIndex(): number {
    return this._slots.findIndex((s) => s.block === null);
  }

  /** Whether any slot could take a tile if its turn came round. */
  private canProgress(): boolean {
    return this._slots.some(
      (s) => s.block !== null && s.remaining > 0 && accessibleOf(this._board, s.block.color).length > 0,
    );
  }

  /**
   * Puts the front block of `column` into the first free slot.
   *
   * It takes nothing yet — it starts counting down from its own number,
   * a tile every {@link TILE_INTERVAL_MS}. Playing does not wait for
   * anything else to finish, so several blocks drain side by side.
   */
  place(column: number, now: number): PlaceOutcome {
    if (this._status !== 'playing') return { kind: 'ignored', reason: 'finished' };

    const stack = this._columns[column];
    const block = stack?.[0];
    if (!stack || !block) return { kind: 'ignored', reason: 'no-such-block' };

    const slotIndex = this.freeSlotIndex();
    if (slotIndex === -1) return { kind: 'ignored', reason: 'no-free-slot' };

    this.pushHistory();

    this._columns = this._columns.map((c, i) => (i === column ? c.slice(1) : c));
    this._slots = this._slots.map((s, i) =>
      i === slotIndex
        ? // Held at its full number for one interval, so the count is
          // seen starting from what the block said.
          { block, remaining: block.count, nextAt: now + TILE_INTERVAL_MS }
        : s,
    );

    return { kind: 'placed', slot: slotIndex, block };
  }

  /**
   * Advances every slot that is due, taking one tile each.
   *
   * Slots are checked in order, so when two want the same tile the lower
   * slot gets it — arbitrary but consistent. A slot whose color has
   * nothing reachable simply waits and tries again next interval.
   */
  tick(now: number): TickOutcome {
    if (this._status !== 'playing') {
      return { taken: [], points: 0, status: this._status };
    }

    const taken: TakenTile[] = [];
    const slots = this._slots.map((s) => ({ ...s }));

    for (const [i, slot] of slots.entries()) {
      if (slot.block === null || slot.remaining === 0) continue;
      if (now < slot.nextAt) continue;

      const result = takeColor(this._board, slot.block.color, 1);
      slot.nextAt = now + TILE_INTERVAL_MS;

      const cell = result.taken[0];
      if (cell === undefined) continue; // nothing reachable; wait it out

      this._board = result.board;
      taken.push({ cell, color: slot.block.color, slot: i });
      slot.remaining -= 1;

      if (slot.remaining === 0) {
        slot.block = null;
        slot.nextAt = 0;
      }
    }

    this._slots = slots;

    let points = taken.length * TILE_SCORE;
    this._score += points;

    if (isCleared(this._board)) {
      this._status = 'won';
      points += CLEAR_BONUS;
      this._score += CLEAR_BONUS;
    } else if (!this.canProgress() && !(this.hasFreeSlot && this.blocksLeft.length > 0)) {
      // Nothing is eating the picture and nothing can be played at it.
      this._status = 'stuck';
    }

    return { taken, points, status: this._status };
  }

  /** Steps back to before the last block was played, timers and all. */
  undo(now: number): boolean {
    const prev = this._history.pop();
    if (!prev) return false;

    this._board = prev.board;
    this._columns = prev.columns;
    // Restored timers are stale, so anything still draining restarts its
    // interval rather than firing a burst to catch up.
    this._slots = prev.slots.map((s) =>
      s.block !== null && s.remaining > 0 ? { ...s, nextAt: now + TILE_INTERVAL_MS } : { ...s },
    );
    this._score = prev.score;
    this._status = 'playing';
    return true;
  }

  restart(): void {
    this._board = boardFromPicture(this._def.picture);
    this._columns = dealColumns(this._def.blocks, this._def.columns, this._def.seed);
    this._slots = Game.emptySlots(this._def.slots);
    this._status = 'playing';
    this._history = [];
  }

  /** Advances to the next level. Only valid once this one is won. */
  nextLevel(): void {
    if (this._status !== 'won' || this.isLastLevel) return;
    this._index += 1;
    this._def = levelDef(this._index);
    this.restart();
  }

  private pushHistory(): void {
    this._history.push({
      board: this._board,
      columns: this._columns.map((c) => [...c]),
      slots: this._slots.map((s) => ({ ...s })),
      score: this._score,
    });
    if (this._history.length > HISTORY_LIMIT) this._history.shift();
  }
}
