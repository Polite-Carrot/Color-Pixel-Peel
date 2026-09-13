import {
  type Board,
  accessibleOf,
  boardFromPicture,
  isCleared,
  remainingTiles,
  takeColor,
} from './board';
import type { Block } from './blocks';
import { type LevelDef, LEVEL_COUNT, levelDef } from './levels';
import type { ColorId } from './palette';

export type GameStatus = 'playing' | 'won' | 'stuck';

/** A panel slot: empty, or holding a block with tiles still owed. */
export interface Slot {
  block: Block | null;
  /** How much of the block's count is still to be taken. */
  remaining: number;
}

/** Points per tile taken off the picture. */
export const TILE_SCORE = 10;
/** Paid for finishing the picture. */
export const CLEAR_BONUS = 500;

export type PlaceOutcome =
  | { kind: 'ignored'; reason: 'no-free-slot' | 'no-such-block' | 'finished' }
  | {
      kind: 'placed';
      slot: number;
      block: Block;
      /** Tiles taken as a result, including any freed by the cascade. */
      taken: readonly number[];
      points: number;
      /** True when the block could not be fully spent and is now waiting. */
      pending: boolean;
      status: GameStatus;
    };

interface Snapshot {
  board: Board;
  tray: Block[];
  slots: Slot[];
  score: number;
}

const HISTORY_LIMIT = 64;

/**
 * Owns all mutable game state. Free of DOM and rendering so the rules can
 * be tested headlessly.
 */
export class Game {
  private _def: LevelDef;
  private _index: number;
  private _board: Board;
  private _tray: Block[];
  private _slots: Slot[];
  private _score = 0;
  private _status: GameStatus = 'playing';
  private _history: Snapshot[] = [];

  constructor(startLevel = 1, carriedScore = 0) {
    this._index = Math.min(Math.max(1, startLevel), LEVEL_COUNT);
    this._def = levelDef(this._index);
    this._board = boardFromPicture(this._def.picture);
    this._tray = [...this._def.blocks];
    this._slots = Game.emptySlots(this._def.slots);
    this._score = carriedScore;
  }

  private static emptySlots(n: number): Slot[] {
    return Array.from({ length: n }, () => ({ block: null, remaining: 0 }));
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
  /** Blocks not yet played, in tray order. */
  get tray(): readonly Block[] {
    return this._tray;
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

  private freeSlotIndex(): number {
    return this._slots.findIndex((s) => s.block === null);
  }

  /** Whether a waiting block has anything it could take right now. */
  private canProgress(): boolean {
    return this._slots.some(
      (s) => s.block !== null && s.remaining > 0 && accessibleOf(this._board, s.block.color).length > 0,
    );
  }

  /**
   * Plays the tray block at `trayIndex` into the first free slot.
   *
   * A block takes what it can immediately. If fewer tiles of its color
   * are reachable than it asks for, it takes those and **waits** in its
   * slot for the rest — which is what makes the slots worth something:
   * a block that cannot finish ties one up until the picture opens.
   */
  place(trayIndex: number): PlaceOutcome {
    if (this._status !== 'playing') return { kind: 'ignored', reason: 'finished' };

    const block = this._tray[trayIndex];
    if (!block) return { kind: 'ignored', reason: 'no-such-block' };

    /* A safety net rather than a live path: the cascade lets every slot
       take what it can, so a slot still holding a block has nothing
       available — which means filling the last one sets 'stuck' below and
       the guard above catches the next play first. Kept so a future change
       to resolution cannot corrupt the slots silently. */
    const slotIndex = this.freeSlotIndex();
    if (slotIndex === -1) return { kind: 'ignored', reason: 'no-free-slot' };

    this.pushHistory();

    this._tray = this._tray.filter((_, i) => i !== trayIndex);
    this._slots = this._slots.map((s, i) =>
      i === slotIndex ? { block, remaining: block.count } : s,
    );

    const taken = this.resolve();
    const points = taken.length * TILE_SCORE;
    this._score += points;

    let bonus = 0;
    if (isCleared(this._board)) {
      this._status = 'won';
      bonus = CLEAR_BONUS;
      this._score += bonus;
    } else if (this.freeSlotIndex() === -1 && !this.canProgress()) {
      // Every slot is tied up by a block with nothing to take.
      this._status = 'stuck';
    } else if (this._tray.length === 0 && !this.canProgress() && this.freeSlotIndex() !== -1) {
      // Nothing left to play and nothing waiting can move.
      this._status = 'stuck';
    }

    const slot = this._slots[slotIndex] as Slot;

    return {
      kind: 'placed',
      slot: slotIndex,
      block,
      taken,
      points: points + bonus,
      pending: slot.block !== null && slot.remaining > 0,
      status: this._status,
    };
  }

  /**
   * Lets every waiting block take what it can, repeatedly.
   *
   * One removal can expose tiles a different slot was waiting on, so this
   * runs until nothing moves — a single placement can cascade.
   */
  private resolve(): number[] {
    const taken: number[] = [];
    let progressed = true;

    while (progressed) {
      progressed = false;

      for (const [i, slot] of this._slots.entries()) {
        if (slot.block === null || slot.remaining === 0) continue;

        const result = takeColor(this._board, slot.block.color, slot.remaining);
        if (result.taken.length === 0) continue;

        this._board = result.board;
        taken.push(...result.taken);
        progressed = true;

        const remaining = slot.remaining - result.taken.length;
        this._slots = this._slots.map((s, j) =>
          j === i ? (remaining === 0 ? { block: null, remaining: 0 } : { block: s.block, remaining }) : s,
        );
      }
    }

    return taken;
  }

  /** How many tiles of a color are reachable right now. */
  reachable(color: ColorId): number {
    return accessibleOf(this._board, color).length;
  }

  undo(): boolean {
    const prev = this._history.pop();
    if (!prev) return false;
    this._board = prev.board;
    this._tray = prev.tray;
    this._slots = prev.slots;
    this._score = prev.score;
    this._status = 'playing';
    return true;
  }

  restart(): void {
    this._board = boardFromPicture(this._def.picture);
    this._tray = [...this._def.blocks];
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
      tray: [...this._tray],
      slots: this._slots.map((s) => ({ ...s })),
      score: this._score,
    });
    if (this._history.length > HISTORY_LIMIT) this._history.shift();
  }
}
