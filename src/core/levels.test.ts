import { describe, expect, it } from 'vitest';
import { accessibleOf, boardFromPicture, isCleared, remainingOf } from './board';
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

  it.each(indices)('level %i buries at least one color to begin with', (index) => {
    /* The lesson the panel exists to teach: play a block for a color
       nothing has opened up yet and it strands in a slot. A level where
       every color starts showing would never teach it. */
    const def = levelDef(index);
    const board = boardFromPicture(def.picture);
    const colors = [...colorCounts(parsePicture(def.picture)).keys()];

    const buried = colors.filter(
      (c) => remainingOf(board, c) > 0 && accessibleOf(board, c).length === 0,
    );
    expect(buried.length, 'no color starts buried').toBeGreaterThan(0);
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

  while (game.status === 'playing' && plays < 200) {
    const tray = game.tray;
    const playable = tray
      .map((b, i) => ({ b, i, reach: game.reachable(b.color) }))
      .filter((c) => c.reach > 0)
      .sort((a, b) => b.b.count - a.b.count);

    const choice = playable[0] ?? { i: 0 };
    const outcome = game.place(choice.i);
    if (outcome.kind === 'ignored') break;
    plays++;
  }

  return { game, plays };
}

describe('every level can actually be won', () => {
  it.each(indices)('level %i clears under greedy play', (index) => {
    const { game, plays } = playGreedily(index);

    expect(game.status, `level ${index} ended ${game.status} with ${game.tilesLeft} tiles left`).toBe('won');
    expect(isCleared(game.board)).toBe(true);
    expect(game.tray).toHaveLength(0);
    expect(game.slots.every((s) => s.block === null)).toBe(true);
    expect(plays).toBe(levelDef(index).blocks.length);
    expect(game.score).toBeGreaterThan(0);
  });
});
