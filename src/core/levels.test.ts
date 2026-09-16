import { describe, expect, it } from 'vitest';
import { boardFromPicture, isAccessible } from './board';
import { blockTotals } from './blocks';
import { SETTING_COUNT, blocksFor, generateLevel, setting } from './generator';
import { LEVEL_COUNT, levelDef, levelSummaries, levelSummary } from './levels';
import { MIN_DISTANCE, distance, swatch } from './palette';
import { PICTURES, PICTURE_COUNT, picture } from './pictures';
import { colorCounts, parsePicture } from './picture';
import { playGreedily } from './solve';

const indices = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);

describe('the picture library', () => {
  it('has pictures', () => {
    expect(PICTURE_COUNT).toBeGreaterThan(0);
  });

  it('gives every picture a distinct name', () => {
    const names = new Set(PICTURES.map((p) => p.name));
    expect(names.size).toBe(PICTURE_COUNT);
  });

  it.each(PICTURES.map((p, i) => [p.name, i] as const))(
    '%s has square rows and real colors',
    (_name, index) => {
      const art = picture(index);
      const width = (art.rows[0] as string).length;
      for (const row of art.rows) expect(row).toHaveLength(width);

      const parsed = parsePicture(art);
      expect(parsed.tiles.some((t) => t !== null)).toBe(true);
    },
  );

  /* The rule that protects the player: two colors they must tell apart
     never share one picture. Enforced per picture rather than across the
     palette, since `red` and `tan` sit 142 apart and both are worth
     keeping. */
  it.each(PICTURES.map((p, i) => [p.name, i] as const))(
    '%s keeps its colors far enough apart',
    (_name, index) => {
      const colors = [...colorCounts(parsePicture(picture(index))).keys()];
      for (let a = 0; a < colors.length; a++) {
        for (let b = a + 1; b < colors.length; b++) {
          const first = colors[a] as number;
          const second = colors[b] as number;
          const d = distance(first, second);
          expect(d, `${swatch(first).name} and ${swatch(second).name} are ${d.toFixed(0)} apart`)
            .toBeGreaterThanOrEqual(MIN_DISTANCE);
        }
      }
    },
  );

  it.each(PICTURES.map((p, i) => [p.name, i] as const))(
    '%s hides something behind its outline',
    (_name, index) => {
      // Every picture is drawn with an outline, and an outline encloses
      // its own fill — which is what makes reaching a color the puzzle.
      const board = boardFromPicture(picture(index));
      const walled = board.tiles.filter((t, i) => t !== null && !isAccessible(board, i));
      expect(walled.length, 'nothing is covered up').toBeGreaterThan(0);
    },
  );
});

describe('the settings', () => {
  it('gets harder down the list', () => {
    for (let i = 1; i < SETTING_COUNT; i++) {
      const prev = setting(i - 1);
      const next = setting(i);
      /* Fewer slots, and a coarser cut to go with them. Both push the
         same way: less room to park a block, and each block commits you
         for longer. The cut follows the panel because it has to — past
         about fifty blocks at four slots the deals stop being winnable. */
      expect(next.slots).toBeLessThanOrEqual(prev.slots);
      expect(next.blockSize).toBeGreaterThan(prev.blockSize);
      expect(next.maxBlocks).toBeLessThan(prev.maxBlocks);
    }
  });

  it('ends far tighter than it starts', () => {
    const first = setting(0);
    const last = setting(SETTING_COUNT - 1);
    expect(last.slots).toBeLessThanOrEqual(Math.floor(first.slots / 2));
  });

  it('rejects a setting it does not have', () => {
    expect(() => setting(-1)).toThrow(/no setting/);
    expect(() => setting(SETTING_COUNT)).toThrow(/no setting/);
  });
});

describe('the campaign', () => {
  it('is every picture at every setting', () => {
    expect(LEVEL_COUNT).toBe(PICTURE_COUNT * SETTING_COUNT);
  });

  it('sweeps the whole library before hardening', () => {
    const first = levelSummary(1);
    const lastOfBand = levelSummary(PICTURE_COUNT);
    const firstOfNext = levelSummary(PICTURE_COUNT + 1);

    expect(first.setting).toBe(lastOfBand.setting);
    expect(firstOfNext.setting).not.toBe(first.setting);
    expect(firstOfNext.name).toBe(first.name);
  });

  it('brings every picture back at every setting', () => {
    const byName = new Map<string, Set<string>>();
    for (const s of levelSummaries()) {
      const seen = byName.get(s.name) ?? new Set<string>();
      seen.add(s.setting);
      byName.set(s.name, seen);
    }
    expect(byName.size).toBe(PICTURE_COUNT);
    for (const [name, settings] of byName) {
      expect(settings.size, `${name} does not appear at every setting`).toBe(SETTING_COUNT);
    }
  });

  it('summarises a level without dealing it', () => {
    const s = levelSummary(1);
    expect(s.index).toBe(1);
    expect(s.name).toBe((PICTURES[0] as { name: string }).name);
    expect(s.setting).toBe(setting(0).name);
  });

  it('rejects a level number it does not have', () => {
    expect(() => levelDef(0)).toThrow(/no level/);
    expect(() => levelDef(LEVEL_COUNT + 1)).toThrow(/no level/);
  });

  it('deals the same level every time', () => {
    expect(levelDef(7).blocks).toEqual(levelDef(7).blocks);
    expect(levelDef(7).seed).toBe(levelDef(7).seed);
  });
});

describe('the generator', () => {
  it('cuts blocks that add up exactly, at every setting', () => {
    for (let s = 0; s < SETTING_COUNT; s++) {
      for (let p = 0; p < PICTURE_COUNT; p++) {
        const level = generateLevel(p, s, 4242);
        const tiles = colorCounts(parsePicture(level.picture));
        const totals = blockTotals(level.blocks);

        for (const [color, count] of tiles) {
          expect(totals.get(color), `${picture(p).name}/${setting(s).name} ${swatch(color).name}`)
            .toBe(count);
        }
        expect([...totals.keys()].sort()).toEqual([...tiles.keys()].sort());
      }
    }
  });

  /* A setting asks for a number of blocks, not a size, so what there is to
     check is that it got roughly what it asked for — and that no block is
     empty, since a block of nothing could never be played. The count is
     approximate by construction: a color's share is rounded, and a color
     with fewer tiles than its share gets one block per tile. */
  it('cuts roughly the number of blocks the setting asks for', () => {
    for (let settingIndex = 0; settingIndex < SETTING_COUNT; settingIndex++) {
      const rules = setting(settingIndex);
      for (const pictureIndex of [0, Math.floor(PICTURE_COUNT / 2), PICTURE_COUNT - 1]) {
        const level = generateLevel(pictureIndex, settingIndex, 11);
        const where = `${level.name} at ${rules.name}`;
        const want = blocksFor(rules, level.blocks.reduce((n, b) => n + b.count, 0));
        expect(level.blocks.length, where).toBeGreaterThanOrEqual(want * 0.6);
        expect(level.blocks.length, where).toBeLessThanOrEqual(want * 1.6);
        expect(level.blocks.every((b) => b.count >= 1), `${where} has an empty block`).toBe(true);
      }
    }
  });

  /* What the cap is for. A setting aims at a block size, so a picture
     four times the size would want four times the blocks — but only as
     many as its slot count can carry. The smallest picture is nowhere
     near that ceiling and gets the size it asked for; the largest is held
     at it and gets bigger blocks instead. */
  it('caps the cut on a big picture, so its blocks grow instead', () => {
    const rules = setting(2);
    const small = generateLevel(0, 2, 11);
    const large = generateLevel(PICTURE_COUNT - 1, 2, 11);
    const tiles = (level: typeof small) => level.blocks.reduce((n, b) => n + b.count, 0);
    const mean = (level: typeof small) => tiles(level) / level.blocks.length;

    expect(tiles(large)).toBeGreaterThan(tiles(small) * 3);

    // The small one is under the ceiling, and lands on the size asked for.
    expect(small.blocks.length).toBeLessThan(rules.maxBlocks);
    expect(mean(small)).toBeGreaterThan(rules.blockSize - 3);
    expect(mean(small)).toBeLessThan(rules.blockSize + 3);

    // The big one is held at the ceiling, so its blocks are bigger.
    expect(large.blocks.length).toBe(rules.maxBlocks);
    expect(mean(large)).toBeGreaterThan(mean(small));
  });

  it('cuts bigger blocks as the setting hardens', () => {
    // The same picture, harder: fewer blocks, so each is bigger and holds
    // a slot for longer.
    const gentle = generateLevel(PICTURE_COUNT - 1, 0, 99);
    const expert = generateLevel(PICTURE_COUNT - 1, SETTING_COUNT - 1, 99);
    const mean = (l: typeof gentle) =>
      l.blocks.reduce((n, b) => n + b.count, 0) / l.blocks.length;

    expect(expert.blocks.length).toBeLessThan(gentle.blocks.length);
    expect(mean(expert)).toBeGreaterThan(mean(gentle));
  });

  it('refuses a picture it does not have', () => {
    expect(() => generateLevel(-1, 0, 1)).toThrow(/no picture/);
    expect(() => generateLevel(PICTURE_COUNT, 0, 1)).toThrow(/no picture/);
  });
});

/* The guarantee the whole generated campaign rests on: a level is only
   handed over once it has been played through and won. This re-checks
   every one of them, because a dealt hand is not winnable by
   construction the way a fixed table would be. */
describe('every level in the campaign can be won', () => {
  it.each(indices)('level %i', (index) => {
    const level = levelDef(index);
    const run = playGreedily(level);

    expect(run.won, `level ${index} (${level.name}) ended with ${run.tilesLeft} tiles left`).toBe(true);
    expect(run.plays).toBe(level.blocks.length);
    expect(run.peakSlots).toBeLessThanOrEqual(level.slots);
  });
});

describe('the curve, measured', () => {
  it('never hands back a slot', () => {
    const slots = indices.map((i) => levelDef(i).slots);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]).toBeLessThanOrEqual(slots[i - 1] as number);
    }
  });

  it('asks more of the player at the end than at the start', () => {
    const first = levelDef(1);
    const last = levelDef(LEVEL_COUNT);
    expect(last.slots).toBeLessThan(first.slots);
    expect(last.blocks.length).toBeGreaterThan(first.blocks.length);
  });

  it('leaves the late levels no room to spare', () => {
    /* Not a claim about the numbers but about what play feels like: on
       the hardest setting greedy play fills the panel completely, so a
       block spent badly is the difference between winning and jamming. */
    const lastBand = indices.slice(-PICTURE_COUNT);
    const tight = lastBand.filter((i) => {
      const level = levelDef(i);
      return playGreedily(level).peakSlots === level.slots;
    });
    expect(tight.length).toBeGreaterThan(lastBand.length / 2);
  });
});
