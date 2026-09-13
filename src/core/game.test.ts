import { describe, expect, it } from 'vitest';
import { CLEAR_BONUS, Game, TILE_INTERVAL_MS, TILE_SCORE } from './game';
import { isCleared, remainingOf } from './board';
import { block } from './blocks';
import { LEVELS, type LevelDef } from './levels';
import { BLUE, RED } from './palette';

/** A hand-made level, so the rules can be pinned without real artwork. */
function levelOf(over: Partial<LevelDef>): LevelDef {
  return {
    name: 'test',
    brief: 'test',
    picture: { rows: ['RR'], legend: { R: RED, B: BLUE } },
    slots: 2,
    // One column, so these tests play the hand in the order written.
    columns: 1,
    seed: 1,
    blocks: [block(RED, 2)],
    ...over,
  };
}

/**
 * A game on a hand-made level, driven by a clock the test advances by
 * hand — the rules are given the time rather than reading one, which is
 * what makes the pacing testable at all.
 */
function gameOf(def: LevelDef) {
  const game = new Game(1);
  (game as unknown as { _def: LevelDef })._def = def;
  game.restart();

  let now = 1000;
  return {
    game,
    get now() {
      return now;
    },
    place: (column = 0) => game.place(column, now),
    /** Moves time on by one tile interval and lets the rules catch up. */
    step: (intervals = 1) => {
      let last = game.tick(now);
      for (let i = 0; i < intervals; i++) {
        now += TILE_INTERVAL_MS;
        last = game.tick(now);
      }
      return last;
    },
  };
}

describe('playing a block', () => {
  it('takes nothing at first — it starts counting from its own number', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 3)] }));
    const outcome = t.place();

    expect(outcome.kind).toBe('placed');
    expect(t.game.slots[0]?.remaining).toBe(3);
    expect(t.game.tilesLeft).toBe(4);
  });

  it('takes one tile per interval, counting down', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 3)] }));
    t.place();

    t.step();
    expect(t.game.slots[0]?.remaining).toBe(2);
    expect(t.game.tilesLeft).toBe(3);

    t.step();
    expect(t.game.slots[0]?.remaining).toBe(1);
    expect(t.game.tilesLeft).toBe(2);
  });

  it('takes nothing between intervals', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 3)] }));
    t.place();
    // Half an interval is not an interval.
    const outcome = t.game.tick(t.now + TILE_INTERVAL_MS / 2);
    expect(outcome.taken).toHaveLength(0);
    expect(t.game.slots[0]?.remaining).toBe(3);
  });

  it('frees its slot once it is spent', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    t.place();
    t.step(2);

    expect(t.game.slots[0]?.block).toBeNull();
    expect(t.game.slots[0]?.remaining).toBe(0);
    expect(t.game.isDraining).toBe(false);
  });

  it('scores each tile as it goes', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 3)] }));
    t.place();
    t.step();
    expect(t.game.score).toBe(TILE_SCORE);
    t.step();
    expect(t.game.score).toBe(TILE_SCORE * 2);
  });

  it('refuses a block that is not there', () => {
    const t = gameOf(levelOf({}));
    expect(t.place(9)).toEqual({ kind: 'ignored', reason: 'no-such-block' });
  });

  it('refuses a block when every slot is busy', () => {
    const t = gameOf(
      levelOf({
        picture: { rows: ['RRRRRR'], legend: { R: RED } },
        blocks: [block(RED, 2), block(RED, 2), block(RED, 2)],
        slots: 2,
      }),
    );
    t.place();
    t.place();
    expect(t.game.hasFreeSlot).toBe(false);
    expect(t.place()).toEqual({ kind: 'ignored', reason: 'no-free-slot' });
  });
});

describe('several blocks at once', () => {
  it('drains every slot together, not one after another', () => {
    /* The point of the panel: five colors that can reach tiles all count
       down side by side. */
    const t = gameOf(
      levelOf({
        picture: { rows: ['RRRR', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 3), block(BLUE, 3)],
        slots: 2,
        columns: 1,
      }),
    );
    t.place();
    t.place();
    expect(t.game.isDraining).toBe(true);

    const outcome = t.step();
    // One tile from each slot in the same tick.
    expect(outcome.taken).toHaveLength(2);
    expect(t.game.slots[0]?.remaining).toBe(2);
    expect(t.game.slots[1]?.remaining).toBe(2);
    expect(t.game.tilesLeft).toBe(6);
  });

  it('keeps each slot on its own clock', () => {
    const t = gameOf(
      levelOf({
        picture: { rows: ['RRRR', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 4), block(BLUE, 4)],
        slots: 2,
        columns: 1,
      }),
    );
    t.place();
    t.step(2); // red has taken two

    t.place(); // blue starts late
    t.step(1);
    expect(t.game.slots[0]?.remaining).toBe(1);
    expect(t.game.slots[1]?.remaining).toBe(3);
  });
});

describe('a block with nothing to take', () => {
  it('waits without counting down', () => {
    // Red is walled in behind blue, exactly as a picture's outline does.
    const t = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 2), block(BLUE, 10)],
        slots: 2,
      }),
    );
    t.place();
    t.step(4);

    expect(t.game.slots[0]?.remaining).toBe(2);
    expect(t.game.tilesLeft).toBe(12);
  });

  it('starts moving once something opens its color up', () => {
    const t = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 2), block(BLUE, 10)],
        slots: 2,
      }),
    );
    t.place(); // red, stranded
    t.place(); // blue, which will dig it out
    t.step(12);

    expect(remainingOf(t.game.board, RED)).toBe(0);
    expect(isCleared(t.game.board)).toBe(true);
    expect(t.game.status).toBe('won');
  });
});

describe('finishing a level', () => {
  it('wins when the picture is clear, with a bonus', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    t.place();
    const outcome = t.step(2);

    expect(outcome.status).toBe('won');
    expect(t.game.score).toBe(2 * TILE_SCORE + CLEAR_BONUS);
  });

  it('ignores plays once finished', () => {
    const t = gameOf(
      levelOf({ picture: { rows: ['RR'], legend: { R: RED } }, blocks: [block(RED, 2), block(RED, 1)] }),
    );
    t.place();
    t.step(2);
    expect(t.place()).toEqual({ kind: 'ignored', reason: 'finished' });
  });

  it('is stuck when nothing can move and nothing can be played', () => {
    const t = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 1), block(RED, 1)],
        slots: 2,
      }),
    );
    t.place();
    t.place();
    const outcome = t.step();

    expect(outcome.status).toBe('stuck');
    expect(t.game.status).toBe('stuck');
  });

  it('is not stuck while a slot is still free to play into', () => {
    const t = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 1), block(BLUE, 4)],
        slots: 2,
      }),
    );
    t.place(); // red strands, but blue is still in hand
    t.step(2);
    expect(t.game.status).toBe('playing');
  });
});

describe('undo and restart', () => {
  it('undo puts the picture, hand, panel and score back', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    const before = { board: t.game.board, score: t.game.score, held: t.game.blocksLeft.length };

    t.place();
    t.step();
    expect(t.game.score).toBeGreaterThan(before.score);

    expect(t.game.undo(t.now)).toBe(true);
    expect(t.game.board).toBe(before.board);
    expect(t.game.score).toBe(before.score);
    expect(t.game.blocksLeft).toHaveLength(before.held);
    expect(t.game.slots.every((s) => s.block === null)).toBe(true);
  });

  it('undo reverts a block that was part-way through draining', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 3)] }));
    t.place();
    t.step(2);
    expect(t.game.tilesLeft).toBe(2);

    t.game.undo(t.now);
    expect(t.game.tilesLeft).toBe(4);
    expect(t.game.isDraining).toBe(false);
  });

  it('undo rescues a stuck board', () => {
    const t = gameOf(
      levelOf({
        picture: { rows: ['BBBB', 'BRRB', 'BBBB'], legend: { R: RED, B: BLUE } },
        blocks: [block(RED, 1), block(RED, 1)],
        slots: 2,
      }),
    );
    t.place();
    t.place();
    t.step();
    expect(t.game.status).toBe('stuck');

    expect(t.game.undo(t.now)).toBe(true);
    expect(t.game.status).toBe('playing');
  });

  it('has nothing to undo on a fresh level', () => {
    const t = gameOf(levelOf({}));
    expect(t.game.undo(t.now)).toBe(false);
  });

  it('restart puts everything back', () => {
    const t = gameOf(levelOf({ picture: { rows: ['RRRR'], legend: { R: RED } }, blocks: [block(RED, 2)] }));
    t.place();
    t.step();
    t.game.restart();

    expect(t.game.blocksLeft).toHaveLength(1);
    expect(t.game.tilesLeft).toBe(4);
    expect(t.game.status).toBe('playing');
    expect(t.game.canUndo).toBe(false);
  });
});

describe('the real levels', () => {
  it('starts on level 1 with its own hand, slots and columns', () => {
    const game = new Game(1);
    const def = LEVELS[0] as LevelDef;
    expect(game.level.name).toBe(def.name);
    expect(game.blocksLeft).toHaveLength(def.blocks.length);
    expect(game.slots).toHaveLength(def.slots);
    expect(game.columns).toHaveLength(def.columns);
  });

  it('clamps a level number past the end', () => {
    expect(new Game(99).levelIndex).toBe(LEVELS.length);
    expect(new Game(0).levelIndex).toBe(1);
  });
});
