import { describe, expect, it } from 'vitest';
import { accessibleOf, boardFromPicture, isAccessible, isCleared, remainingOf } from './board';
import { blockTotals } from './blocks';
import { Game } from './game';
import { LEVELS, LEVEL_COUNT, levelDef } from './levels';
import { MAX_COLORS, MIN_DISTANCE, distance, swatch } from './palette';
import { colorCounts, parsePicture } from './picture';

const indices = LEVELS.map((_, i) => i + 1);

describe('every level', () => {
  it('has at least one', () => {
    expect(LEVEL_COUNT).toBeGreaterThan(0);
  });

  it.each(indices)('level %i parses into a picture with tiles', (index) => {
    const picture = parsePicture(levelDef(index).picture);
    expect(picture.tiles.some((t) => t !== null)).toBe(true);
  });

  it.each(indices)('level %i only uses real colors', (index) => {
    for (const color of colorCounts(parsePicture(levelDef(index).picture)).keys()) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThan(MAX_COLORS);
    }
  });

  // The balance the whole design rests on: spend every block and the
  // picture is exactly clear, with nothing spare and nothing missing.
  it.each(indices)('level %i has blocks that add up to its tiles exactly', (index) => {
    const def = levelDef(index);
    const tiles = colorCounts(parsePicture(def.picture));
    const totals = blockTotals([...def.blocks]);

    for (const [color, count] of tiles) {
      expect(totals.get(color), `${swatch(color).name} blocks`).toBe(count);
    }
    // And no block for a color the picture does not contain.
    for (const color of totals.keys()) {
      expect(tiles.get(color), `${swatch(color).name} tiles`).toBeDefined();
    }
  });

  // The rule that actually protects the player: two colors they have to
  // tell apart must never appear in the same artwork.
  it.each(indices)('level %i keeps its colors far enough apart to tell apart', (index) => {
    const colors = [...colorCounts(parsePicture(levelDef(index).picture)).keys()];
    for (let a = 0; a < colors.length; a++) {
      for (let b = a + 1; b < colors.length; b++) {
        const first = colors[a] as number;
        const second = colors[b] as number;
        const d = distance(first, second);
        expect(
          d,
          `${swatch(first).name} and ${swatch(second).name} are ${d.toFixed(0)} apart`,
        ).toBeGreaterThanOrEqual(MIN_DISTANCE);
      }
    }
  });

  it.each(indices)('level %i says what it is', (index) => {
    const def = levelDef(index);
    expect(def.name.length).toBeGreaterThan(0);
    expect(def.brief.length).toBeGreaterThan(20);
    // Player-facing copy, so US spelling.
    expect(def.brief).not.toMatch(/colour/);
  });

  it.each(indices)('level %i gives the panel room to hold a mistake', (index) => {
    expect(levelDef(index).slots).toBeGreaterThan(1);
  });

  it.each(indices)('level %i offers a real choice of blocks', (index) => {
    // One column would be a fixed sequence with no decisions in it.
    expect(levelDef(index).columns).toBeGreaterThan(1);
  });

  it('rejects a level number it does not have', () => {
    expect(() => levelDef(0)).toThrow(/no level/);
    expect(() => levelDef(LEVEL_COUNT + 1)).toThrow(/no level/);
  });
});

describe('the picture opens up', () => {
  it.each(indices)('level %i starts with something reachable', (index) => {
    const board = boardFromPicture(levelDef(index).picture);
    const reachable = [...colorCounts(parsePicture(levelDef(index).picture)).keys()].filter(
      (c) => accessibleOf(board, c).length > 0,
    );
    expect(reachable.length).toBeGreaterThan(0);
  });

  /* The opening levels are meant to be walked through, so nothing being
     buried in them is correct rather than a gap. From the third on, the
     picture has to hide something — that is where the panel starts to
     mean anything. */
  const CHALLENGING_FROM = 3;

  it.each(indices.filter((i) => i >= CHALLENGING_FROM))(
    'level %i buries at least one color to begin with',
    (index) => {
      const def = levelDef(index);
      const board = boardFromPicture(def.picture);
      const colors = [...colorCounts(parsePicture(def.picture)).keys()];

      const buried = colors.filter(
        (c) => remainingOf(board, c) > 0 && accessibleOf(board, c).length === 0,
      );
      expect(buried.length, 'no color starts buried').toBeGreaterThan(0);
    },
  );

  it.each(indices)('level %i has tiles that must be uncovered first', (index) => {
    /* True of every outlined picture, and the reason the rule matters at
       all: the outline encloses the fill, so the way in is the edge. On
       the Heart that is the whole lesson — its red is enclosed entirely,
       so a red block played first has nowhere to go. */
    const def = levelDef(index);
    const board = boardFromPicture(def.picture);
    const walled = board.tiles.filter((t, i) => t !== null && !isAccessible(board, i));
    expect(walled.length, 'nothing is covered up').toBeGreaterThan(0);
  });
});

/**
 * Plays a level the way a reasonable player would: always spend a block
 * whose color has tiles showing, biggest first, and only strand one when
 * there is no other choice. If this clears the picture, the level is
 * winnable without foresight.
 */
function playGreedily(index: number): { game: Game; plays: number } {
  const game = new Game(index);
  let plays = 0;

  while (game.status === 'playing' && plays < 400) {
    /* Only the front of each column can be played, so the choice is
       between at most one block per column — which is the whole of the
       constraint this checks the level against. */
    const choices = game.fronts
      .map((b, i) => ({ b, i, reach: b ? game.reachable(b.color) : -1 }))
      .filter((c) => c.b !== null);

    const useful = choices.filter((c) => c.reach > 0).sort((a, b) => (b.b?.count ?? 0) - (a.b?.count ?? 0));
    const choice = useful[0] ?? choices[0];
    if (!choice) break;

    const outcome = game.place(choice.i);
    if (outcome.kind === 'ignored') break;
    plays++;
  }

  return { game, plays };
}

describe('the difficulty curve', () => {
  it('never gets smaller as it goes', () => {
    // Each level is at least as big as the one before it, so the ramp is
    // a property of the data rather than of the order they were written.
    const sizes = indices.map((i) => parsePicture(levelDef(i).picture).tiles.filter((t) => t !== null).length);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i], `level ${i + 1} is smaller than level ${i}`).toBeGreaterThanOrEqual(sizes[i - 1] as number);
    }
  });

  it('starts small enough to be a first level', () => {
    const first = parsePicture(levelDef(1).picture).tiles.filter((t) => t !== null).length;
    expect(first).toBeLessThan(60);
    expect(levelDef(1).blocks.length).toBeLessThan(12);
  });

  it('ends harder than it starts', () => {
    const last = levelDef(LEVEL_COUNT);
    const first = levelDef(1);
    expect(last.blocks.length).toBeGreaterThan(first.blocks.length);
    // Fewer slots, or more colors, or both — but not easier on every axis.
    expect(last.slots <= first.slots || last.columns > first.columns).toBe(true);
  });
});

describe('every level can actually be won', () => {
  it.each(indices)('level %i clears under greedy play', (index) => {
    const { game, plays } = playGreedily(index);

    expect(game.status, `level ${index} ended ${game.status} with ${game.tilesLeft} tiles left`).toBe('won');
    expect(isCleared(game.board)).toBe(true);
    expect(game.blocksLeft).toHaveLength(0);
    expect(game.slots.every((s) => s.block === null)).toBe(true);
    expect(plays).toBe(levelDef(index).blocks.length);
    expect(game.score).toBeGreaterThan(0);
  });
});
