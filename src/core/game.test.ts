import { describe, expect, it } from 'vitest';
import { Game, clearBonus, regionScore } from './game';
import { isCleared } from './board';
import { type Level, levelConfig } from './level';
import { boardFrom } from './test-helpers';

/** Wraps a hand-made board as a Level so loss paths can be forced. */
function levelOf(layers: readonly (readonly string[])[], moveLimit: number): Level {
  return {
    index: 1,
    seed: 0,
    config: levelConfig(1),
    board: boardFrom(layers),
    solution: [],
    moveLimit,
  };
}

/** One 2-cell region, clearable in a single move. */
const oneMoveWin = (): Level => levelOf([['00']], 3);

/** Two layers deep but only one move allowed. */
const outOfMoves = (): Level => levelOf([['00'], ['11']], 1);

/**
 * Tops are 1,1,2,0 — one legal move, after which the remaining tops
 * (0,1,2,0) are all isolated singles.
 */
const deadEnd = (): Level => levelOf([['0120'], ['11..']], 5);

describe('scoring', () => {
  it('rewards bigger regions superlinearly', () => {
    expect(regionScore(2)).toBe(20);
    expect(regionScore(4)).toBe(80);
    // Two 2-cell peels are worth far less than one 4-cell peel.
    expect(regionScore(2) * 2).toBeLessThan(regionScore(4));
  });

  it('pays a clear bonus that grows with unused moves', () => {
    expect(clearBonus(0)).toBe(250);
    expect(clearBonus(3)).toBeGreaterThan(clearBonus(0));
  });
});

describe('Game taps', () => {
  it('ignores a tap on a single-cell region without spending a move', () => {
    const game = new Game(levelOf([['01']], 5));
    expect(game.tap(0)).toEqual({ kind: 'ignored' });
    expect(game.movesUsed).toBe(0);
    expect(game.score).toBe(0);
    expect(game.canUndo).toBe(false);
  });

  it('scores a legal peel and spends one move', () => {
    const game = new Game(levelOf([['000']], 5));
    const outcome = game.tap(0);
    expect(outcome.kind).toBe('peeled');
    if (outcome.kind !== 'peeled') throw new Error('expected a peel');
    expect(outcome.peeled).toHaveLength(3);
    expect(outcome.points).toBe(regionScore(3));
    expect(game.movesUsed).toBe(1);
    expect(game.movesLeft).toBe(4);
  });

  it('carries a starting score forward', () => {
    const game = new Game(levelOf([['00']], 5), 1000);
    expect(game.score).toBe(1000);
    game.tap(0);
    expect(game.score).toBe(1000 + regionScore(2) + clearBonus(4));
  });

  it('ignores taps once the level has ended', () => {
    const game = new Game(oneMoveWin());
    game.tap(0);
    expect(game.status).toBe('won');
    expect(game.tap(0)).toEqual({ kind: 'ignored' });
    expect(game.movesUsed).toBe(1);
  });
});

describe('Game outcomes', () => {
  it('wins when the last layer comes off, with a bonus', () => {
    const game = new Game(oneMoveWin());
    const outcome = game.tap(0);
    if (outcome.kind !== 'peeled') throw new Error('expected a peel');

    expect(outcome.status).toBe('won');
    expect(outcome.bonus).toBe(clearBonus(2));
    expect(game.status).toBe('won');
    expect(isCleared(game.board)).toBe(true);
    expect(game.levelScore).toBe(regionScore(2) + clearBonus(2));
  });

  it('loses when the move limit runs out mid-board', () => {
    const game = new Game(outOfMoves());
    const outcome = game.tap(0);
    if (outcome.kind !== 'peeled') throw new Error('expected a peel');

    expect(outcome.status).toBe('lost');
    expect(game.lossReason).toBe('out-of-moves');
    expect(game.movesLeft).toBe(0);
    expect(isCleared(game.board)).toBe(false);
  });

  it('loses when only single-cell regions remain', () => {
    const game = new Game(deadEnd());
    const outcome = game.tap(0);
    if (outcome.kind !== 'peeled') throw new Error('expected a peel');

    expect(outcome.status).toBe('lost');
    expect(game.lossReason).toBe('no-moves');
    // Still had moves in the bank — it was the board that dried up.
    expect(game.movesLeft).toBeGreaterThan(0);
  });

  it('prefers a win over the move limit when the last move clears', () => {
    // Exactly one move allowed, and that move clears the board.
    const game = new Game(levelOf([['00']], 1));
    game.tap(0);
    expect(game.status).toBe('won');
    expect(game.movesLeft).toBe(0);
  });
});

describe('Game undo', () => {
  it('restores board, moves and score', () => {
    const game = new Game(levelOf([['000'], ['111']], 5));
    const before = { board: game.board, score: game.score };

    game.tap(0);
    expect(game.movesUsed).toBe(1);
    expect(game.score).toBeGreaterThan(before.score);

    expect(game.undo()).toBe(true);
    expect(game.board).toBe(before.board);
    expect(game.score).toBe(before.score);
    expect(game.movesUsed).toBe(0);
    expect(game.canUndo).toBe(false);
  });

  it('rescues the player from a lost board', () => {
    const game = new Game(deadEnd());
    game.tap(0);
    expect(game.status).toBe('lost');

    expect(game.undo()).toBe(true);
    expect(game.status).toBe('playing');
    expect(game.lossReason).toBeUndefined();
  });

  it('reports nothing to undo on a fresh level', () => {
    const game = new Game(oneMoveWin());
    expect(game.undo()).toBe(false);
  });

  it('steps back through several peels', () => {
    const game = new Game(levelOf([['00'], ['11'], ['22']], 9));
    game.tap(0);
    game.tap(0);
    expect(game.movesUsed).toBe(2);
    game.undo();
    game.undo();
    expect(game.movesUsed).toBe(0);
    expect(game.score).toBe(0);
    expect(game.undo()).toBe(false);
  });
});

describe('Game level lifecycle', () => {
  it('restart refunds the score earned in the level', () => {
    const game = new Game(levelOf([['000'], ['111']], 5), 500);
    game.tap(0);
    expect(game.score).toBeGreaterThan(500);

    game.restart();
    expect(game.score).toBe(500);
    expect(game.levelScore).toBe(0);
    expect(game.movesUsed).toBe(0);
    expect(game.status).toBe('playing');
    expect(game.canUndo).toBe(false);
  });

  it('restart recovers a lost level', () => {
    const game = new Game(outOfMoves());
    game.tap(0);
    expect(game.status).toBe('lost');
    game.restart();
    expect(game.status).toBe('playing');
    expect(game.movesLeft).toBe(1);
  });

  it('advances to the next level only after a win, keeping the score', () => {
    const game = new Game(oneMoveWin());

    game.nextLevel();
    expect(game.levelIndex).toBe(1); // refused while still playing

    game.tap(0);
    const earned = game.score;
    game.nextLevel();

    expect(game.levelIndex).toBe(2);
    expect(game.status).toBe('playing');
    expect(game.movesUsed).toBe(0);
    expect(game.levelScore).toBe(0);
    expect(game.score).toBe(earned);
    expect(isCleared(game.board)).toBe(false);
  });

  it('generates a real playable board when advancing', () => {
    const game = new Game(oneMoveWin());
    game.tap(0);
    game.nextLevel();
    expect(game.level.solution.length).toBeGreaterThan(0);
    expect(game.movesLeft).toBe(game.level.moveLimit);
  });

  it('plays a generated level to completion with its own solution', () => {
    const game = new Game(1);
    for (const move of game.level.solution) {
      const outcome = game.tap(move);
      expect(outcome.kind).toBe('peeled');
    }
    expect(game.status).toBe('won');
    expect(isCleared(game.board)).toBe(true);
  });
});
