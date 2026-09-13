import { describe, expect, it } from 'vitest';
import { CLEAR_BONUS, Game, TILE_SCORE } from './game';
import { isCleared, remainingOf } from './board';
import { block } from './blocks';
import { LEVELS, type LevelDef } from './levels';
import { BLUE, RED } from './palette';

/** A hand-made level, so the rules can be pinned without the real artwork. */
function levelOf(over: Partial<LevelDef>): LevelDef {
  return {
    name: 'test',
    brief: 'test',
    picture: { rows: ['RR'], legend: { R: RED, B: BLUE } },
    slots: 2,
    blocks: [block(RED, 2)],
    ...over,
  };
}

function gameOf(def: LevelDef): Game {
  const game = new Game(1);
  // Drive the game from a hand-made level by replacing its definition.
  (game as unknown as { _def: LevelDef })._def = def;
  game.restart();
  return game;
}

describe('placing a block', () => {
  it('takes that many tiles of its color', () => {
    const game = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 3)] }));
    const outcome = game.place(0);

    expect(outcome.kind).toBe('placed');
    if (outcome.kind !== 'placed') throw new Error('expected a placement');
    expect(outcome.taken).toHaveLength(3);
    expect(outcome.points).toBe(3 * TILE_SCORE);
    expect(remainingOf(game.board, RED)).toBe(1);
    expect(game.tray).toHaveLength(0);
  });

  it('frees its slot again once fully spent', () => {
    const game = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    game.place(0);
    expect(game.slots.every((s) => s.block === null)).toBe(true);
  });

  it('waits in its slot when it cannot be fully spent', () => {
    // Only the border reds are reachable; the two inside are walled in.
    const game = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 2)],
        slots: 2,
      }),
    );
    const outcome = game.place(0);
    if (outcome.kind !== 'placed') throw new Error('expected a placement');

    expect(outcome.taken).toHaveLength(0);
    expect(outcome.pending).toBe(true);
    expect(game.slots[0]?.block).not.toBeNull();
    expect(game.slots[0]?.remaining).toBe(2);
  });

  it('takes what it can and waits for the rest', () => {
    // One red reachable on the edge, one buried behind blues.
    const game = gameOf(
      levelOf({
        picture: { rows: ['RBBB', 'BBRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 2)],
      }),
    );
    const outcome = game.place(0);
    if (outcome.kind !== 'placed') throw new Error('expected a placement');

    expect(outcome.taken).toHaveLength(1);
    expect(outcome.pending).toBe(true);
    expect(game.slots[0]?.remaining).toBe(1);
  });

  it('is stuck, not merely slot-less, once the last slot fills', () => {
    /* Filling the last slot IS the stuck condition: the cascade has
       already let every slot take what it could, so a slot still holding
       a block is one with nothing available. There is therefore no state
       where the slots are full and the game is still playable, and the
       refusal a further play gets is 'finished' rather than
       'no-free-slot'. */
    const game = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 1), block(RED, 1), block(RED, 1)],
        slots: 2,
      }),
    );
    game.place(0);
    game.place(0);
    expect(game.slots.every((s) => s.block !== null)).toBe(true);
    expect(game.status).toBe('stuck');
    expect(game.place(0)).toEqual({ kind: 'ignored', reason: 'finished' });
  });

  it('refuses a block that is not there', () => {
    const game = gameOf(levelOf({}));
    expect(game.place(9)).toEqual({ kind: 'ignored', reason: 'no-such-block' });
  });
});

describe('the cascade', () => {
  it('lets a waiting block finish once the picture opens up', () => {
    /* Red is buried behind blue. Playing red first strands it in a slot;
       playing blue then opens the reds, and the waiting red block takes
       them without being played again. */
    const game = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 2), block(BLUE, 10)],
        slots: 2,
      }),
    );

    const first = game.place(0);
    if (first.kind !== 'placed') throw new Error('expected a placement');
    expect(first.taken).toHaveLength(0);
    expect(first.pending).toBe(true);

    const second = game.place(0); // the blue block, now at index 0
    if (second.kind !== 'placed') throw new Error('expected a placement');

    // The blues went, and the reds they were hiding went with them.
    expect(remainingOf(game.board, RED)).toBe(0);
    expect(game.slots.every((s) => s.block === null)).toBe(true);
    expect(isCleared(game.board)).toBe(true);
    expect(second.status).toBe('won');
  });
});

describe('finishing a level', () => {
  it('wins when the picture is clear, with a bonus', () => {
    const game = gameOf(levelOf({ picture: { rows: ['RR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    const outcome = game.place(0);
    if (outcome.kind !== 'placed') throw new Error('expected a placement');

    expect(game.status).toBe('won');
    expect(outcome.points).toBe(2 * TILE_SCORE + CLEAR_BONUS);
    expect(game.score).toBe(2 * TILE_SCORE + CLEAR_BONUS);
  });

  it('ignores further plays once finished', () => {
    const game = gameOf(
      levelOf({ picture: { rows: ['RR'], legend: { R: RED } }, blocks: [block(RED, 2), block(RED, 1)] }),
    );
    game.place(0);
    expect(game.place(0)).toEqual({ kind: 'ignored', reason: 'finished' });
  });

  it('is stuck when every slot is tied up with nothing to take', () => {
    const game = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 1), block(RED, 1)],
        slots: 2,
      }),
    );
    game.place(0);
    const last = game.place(0);
    if (last.kind !== 'placed') throw new Error('expected a placement');
    expect(last.status).toBe('stuck');
    expect(game.status).toBe('stuck');
  });

  it('is stuck when the tray is empty and nothing can move', () => {
    const game = gameOf(
      levelOf({
        picture: { rows: ['RRRR'], legend: { R: RED } },
        blocks: [block(RED, 1)],
        slots: 3,
      }),
    );
    const outcome = game.place(0);
    if (outcome.kind !== 'placed') throw new Error('expected a placement');
    expect(outcome.status).toBe('stuck');
  });
});

describe('undo and restart', () => {
  it('undo puts the picture, tray, slots and score back', () => {
    const game = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    const before = { board: game.board, score: game.score, tray: game.tray.length };

    game.place(0);
    expect(game.score).toBeGreaterThan(before.score);

    expect(game.undo()).toBe(true);
    expect(game.board).toBe(before.board);
    expect(game.score).toBe(before.score);
    expect(game.tray).toHaveLength(before.tray);
    expect(game.canUndo).toBe(false);
  });

  it('undo rescues a stuck board', () => {
    const game = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 1), block(RED, 1)],
        slots: 2,
      }),
    );
    game.place(0);
    game.place(0);
    expect(game.status).toBe('stuck');
    expect(game.undo()).toBe(true);
    expect(game.status).toBe('playing');
  });

  it('has nothing to undo on a fresh level', () => {
    expect(gameOf(levelOf({})).undo()).toBe(false);
  });

  it('restart puts everything back', () => {
    const game = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    game.place(0);
    game.restart();
    expect(game.tray).toHaveLength(1);
    expect(game.tilesLeft).toBe(4);
    expect(game.status).toBe('playing');
    expect(game.canUndo).toBe(false);
  });
});

describe('the real levels', () => {
  it('starts on level 1 with its own hand and slots', () => {
    const game = new Game(1);
    const def = LEVELS[0] as LevelDef;
    expect(game.level.name).toBe(def.name);
    expect(game.tray).toHaveLength(def.blocks.length);
    expect(game.slots).toHaveLength(def.slots);
    expect(game.tilesLeft).toBeGreaterThan(0);
  });

  it('clamps a level number past the end', () => {
    expect(new Game(99).levelIndex).toBe(LEVELS.length);
    expect(new Game(0).levelIndex).toBe(1);
  });
});
