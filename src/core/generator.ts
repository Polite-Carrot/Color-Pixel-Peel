import { blockTotals, type Block, block } from './blocks';
import type { LevelDef } from './levels';
import { colorCounts, parsePicture } from './picture';
import { PICTURE_COUNT, picture } from './pictures';
import { createRng } from './rng';
import { playGreedily } from './solve';

/**
 * A difficulty setting. Everything a level needs beyond its picture and
 * its seed.
 *
 * A setting says **how many blocks the picture is cut into**, not how big
 * a block is. That has to scale with the artwork: the pictures run from
 * 156 tiles to 748, so a fixed band of "four to seven tiles a block"
 * would cut the Heart into thirty blocks and the Owl into a hundred and
 * fifty. Counting blocks instead means the Heart and the Owl are the same
 * shape of problem, and the Owl is harder because its blocks are bigger
 * and each one commits you for longer.
 *
 * More blocks is harder: every play is another chance to spend one on a
 * color the picture has not opened up yet. Slots tighten at the same
 * time, so there is less room to park a block that cannot move.
 */
export interface Setting {
  name: string;
  /** Roughly how many blocks the picture is cut into, across all colors. */
  blocks: number;
  slots: number;
  columns: number;
}

/* Measured, not guessed. Every one of these was swept against all 100
   pictures before it was written down: the hard end is where it is
   because past it the deals stop being winnable at all. Expert at 64
   blocks left fourteen pictures undealable however often it reseeded. */
export const SETTINGS: readonly Setting[] = [
  { name: 'Gentle', blocks: 20, slots: 5, columns: 3 },
  { name: 'Easy', blocks: 26, slots: 5, columns: 4 },
  { name: 'Normal', blocks: 32, slots: 4, columns: 4 },
  { name: 'Hard', blocks: 38, slots: 3, columns: 4 },
  { name: 'Expert', blocks: 44, slots: 2, columns: 5 },
];

export const SETTING_COUNT = SETTINGS.length;

export function setting(index: number): Setting {
  const found = SETTINGS[index];
  if (!found) throw new Error(`setting: no setting at index ${index}`);
  return found;
}

/**
 * Cuts one color's `total` tiles into `pieces` blocks that sum to exactly
 * `total`.
 *
 * Exactness is the whole game: spend every block and the picture is
 * clear, with nothing spare and nothing missing. So this divides rather
 * than samples — there is no remainder to lose.
 *
 * Even parts would put the same number on every block of a color, which
 * reads as arithmetic rather than as a hand, so units are shifted between
 * pairs afterwards. Never below one: a block of nothing is not a block.
 */
function cut(total: number, pieces: number, rng: { int(n: number): number }): number[] {
  const n = Math.max(1, Math.min(pieces, total));
  const base = Math.floor(total / n);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(base + (i < total % n ? 1 : 0));

  const swing = Math.max(1, Math.floor(base / 3));
  for (let i = 0; i + 1 < n; i += 2) {
    const from = out[i] as number;
    const to = out[i + 1] as number;
    const move = rng.int(swing + 1);
    if (from - move < 1) continue;
    out[i] = from - move;
    out[i + 1] = to + move;
  }

  return out;
}

/**
 * How many blocks a color is worth, given how much of the picture it is.
 *
 * Share of the tiles rather than an equal split per color: the Owl's
 * brown is most of the bird and its orange beak is four tiles, and giving
 * them the same number of blocks would make the beak into four blocks of
 * one.
 */
function share(count: number, total: number, blocks: number): number {
  return Math.max(1, Math.round((blocks * count) / total));
}

/**
 * Builds one level, without checking whether it can be won.
 *
 * `blocks` is passed in rather than read off the setting so the caller can
 * ease it — see {@link generateLevel}.
 */
function deal(pictureIndex: number, settingIndex: number, seed: number, blocks: number): LevelDef {
  const art = picture(pictureIndex);
  const rules = setting(settingIndex);
  const rng = createRng(seed);

  const counts = colorCounts(parsePicture(art));
  const total = [...counts.values()].reduce((n, c) => n + c, 0);
  const hand: Block[] = [];
  const want = blocks;

  // Sorted by color id so the hand is built in a fixed order; the deal
  // shuffles it afterwards anyway.
  for (const color of [...counts.keys()].sort((a, b) => a - b)) {
    const count = counts.get(color) as number;
    for (const size of cut(count, share(count, total, want), rng)) {
      hand.push(block(color, size));
    }
  }

  return {
    name: art.name,
    brief: brief(rules, hand.length),
    picture: art,
    slots: rules.slots,
    columns: rules.columns,
    seed,
    blocks: hand,
  };
}

function brief(rules: Setting, blocks: number): string {
  return (
    `${rules.name} — ${blocks} blocks, ${rules.slots} slot${rules.slots === 1 ? '' : 's'}. ` +
    'Only tiles the picture has opened up can be taken.'
  );
}

/**
 * How many reseeds to try before giving up on a picture and setting.
 *
 * Raised from 40 when the artwork got four times finer: with two slots and
 * forty-four blocks a jam is common enough that a winnable deal can take a
 * hundred tries. Cheap to spend, because a level is dealt once and kept.
 */
const ATTEMPTS = 400;

/**
 * After this many failures in a row, ask for fewer blocks.
 *
 * A setting is a target, not a promise it can keep on every picture. The
 * Deer is the case that forced this: three colors, one of them a muzzle of
 * eight tiles walled in behind the rest, and at Expert's two slots holding
 * that one block is half the panel. Cut into forty-four blocks almost
 * every deal of it jams, and no amount of reseeding reliably finds the one
 * that does not.
 *
 * So rather than reseed forever, or drag the whole Expert run down to what
 * its worst picture can take, the cut eases for that picture alone. The
 * difference is a handful of blocks on one level out of five hundred, and
 * what it buys is the guarantee: nothing ships unwinnable.
 */
const EASE_AFTER = 30;
const EASE_STEP = 0.9;
const FEWEST_BLOCKS = 8;

/**
 * Builds a level and proves it can be won before handing it over.
 *
 * A dealt hand is not automatically winnable: with few slots a run of
 * blocks for colors still sealed behind the outline can jam the panel.
 * So the level is played through by {@link playGreedily} and re-dealt on
 * the next seed until one survives — the same bargain Color Match makes,
 * where a puzzle is kept only if the solver can finish it.
 *
 * Throws rather than return something unplayable.
 */
export function generateLevel(pictureIndex: number, settingIndex: number, seed: number): LevelDef {
  if (pictureIndex < 0 || pictureIndex >= PICTURE_COUNT) {
    throw new Error(`generateLevel: no picture ${pictureIndex}`);
  }

  const target = setting(settingIndex).blocks;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const eased = Math.max(
      FEWEST_BLOCKS,
      Math.round(target * EASE_STEP ** Math.floor(attempt / EASE_AFTER)),
    );
    const level = deal(pictureIndex, settingIndex, seed + attempt, eased);

    // The exactness the game rests on, checked on every deal rather than
    // trusted to the partitioner.
    const tiles = colorCounts(parsePicture(level.picture));
    const totals = blockTotals(level.blocks);
    for (const [color, count] of tiles) {
      if (totals.get(color) !== count) {
        throw new Error(`generateLevel: blocks do not add up for color ${color}`);
      }
    }

    if (playGreedily(level).won) return level;
  }

  throw new Error(
    `generateLevel: could not deal a winnable ${setting(settingIndex).name} hand for ` +
      `${picture(pictureIndex).name} in ${ATTEMPTS} attempts`,
  );
}
