import { blockTotals, type Block, block } from './blocks';
import type { LevelDef } from './levels';
import type { ColorId } from './palette';
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
 * shape of problem.
 *
 * **The panel is the ramp, and the cut follows it.** That is the opposite
 * of what this used to say, and it is what the measurements forced: how
 * many blocks a setting can carry is capped by how many slots it gives,
 * and the cap falls steeply. Against all 100 pictures, dealt and played:
 *
 *   5 slots   58 blocks -> 100 of 100 winnable, 70 -> 96
 *   4 slots   50 blocks -> 100,                 56 -> 98
 *   3 slots   44 blocks -> 100,                 48 -> 98
 *   2 slots   44 blocks -> 100,                 48 -> 98
 *
 * So blocks cannot rise as slots fall — past the cap the deals simply
 * stop being winnable. They fall instead, and that is a difficulty story
 * in its own right: fewer slots **and** bigger blocks both commit you for
 * longer, so the two levers push the same way rather than fighting.
 *
 * So a setting aims for a block **size** and lets the count fall out of
 * the picture, then clamps that count to the cap. Aiming at the count
 * directly does not work across a library this wide: fifty-six blocks is
 * a sensible cut of the 748-tile Owl and an absurd one of the 156-tile
 * Heart, where it comes out as fifty-six blocks of two or three.
 *
 * The cap still bites on the biggest pictures — the Owl at Expert wants
 * blocks of eleven and gets blocks of eighteen, because forty-two is all
 * two slots will carry. That is the honest limit of a 748-tile picture,
 * not something a setting can tune away.
 */
export interface Setting {
  name: string;
  /** The size of block the cut aims for. */
  blockSize: number;
  /** Ceiling on the number of blocks — what this slot count can carry. */
  maxBlocks: number;
  slots: number;
  columns: number;
}

/* Measured, not guessed — the caps are from the sweep above. */
export const SETTINGS: readonly Setting[] = [
  { name: 'Gentle', blockSize: 7, maxBlocks: 56, slots: 5, columns: 3 },
  { name: 'Easy', blockSize: 8, maxBlocks: 52, slots: 5, columns: 4 },
  { name: 'Normal', blockSize: 9, maxBlocks: 50, slots: 4, columns: 4 },
  { name: 'Hard', blockSize: 10, maxBlocks: 46, slots: 3, columns: 4 },
  { name: 'Expert', blockSize: 11, maxBlocks: 42, slots: 2, columns: 5 },
];

/** No picture is ever one block, however small it is. */
const FEWEST = 6;

/** How many blocks a setting wants this picture cut into. */
export function blocksFor(rules: Setting, tiles: number): number {
  return Math.min(rules.maxBlocks, Math.max(FEWEST, Math.round(tiles / rules.blockSize)));
}

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
 * Splits `want` blocks between the colors, by how much of the picture
 * each one is.
 *
 * Share of the tiles rather than an equal split per color: the Owl's
 * brown is most of the bird and its beak is a dozen tiles, and giving
 * them the same number of blocks would make the beak into blocks of one.
 *
 * Largest remainder rather than rounding each color on its own, because
 * the total has to land on `want` exactly. Rounding independently
 * overshoots — the seven-color Owl came out at 51 blocks against a
 * ceiling of 50 — and a ceiling that leaks is not a ceiling, which
 * matters here because it is the thing keeping the deals winnable.
 *
 * Every color gets at least one block and never more blocks than it has
 * tiles, so those two bounds are applied first and the remainder shared
 * out among whatever slack is left.
 */
function shares(counts: ReadonlyMap<ColorId, number>, want: number): Map<ColorId, number> {
  const colors = [...counts.keys()].sort((a, b) => a - b);
  const total = [...counts.values()].reduce((n, c) => n + c, 0);
  const out = new Map<ColorId, number>();

  const remainders: { color: ColorId; frac: number }[] = [];
  let given = 0;

  for (const color of colors) {
    const count = counts.get(color) as number;
    const raw = (want * count) / total;
    const floor = Math.min(count, Math.max(1, Math.floor(raw)));
    out.set(color, floor);
    given += floor;
    if (floor < count) remainders.push({ color, frac: raw - Math.floor(raw) });
  }

  // Biggest fractional part first, and stop the moment the cap is met.
  remainders.sort((a, b) => b.frac - a.frac);
  for (const { color } of remainders) {
    if (given >= want) break;
    const count = counts.get(color) as number;
    const have = out.get(color) as number;
    if (have >= count) continue;
    out.set(color, have + 1);
    given += 1;
  }

  /* The floors alone can already exceed the cap when there are more
     colors than blocks asked for. Take back from the colors holding the
     most, never below one. */
  while (given > want) {
    const biggest = colors.reduce((a, b) => ((out.get(b) as number) > (out.get(a) as number) ? b : a));
    const have = out.get(biggest) as number;
    if (have <= 1) break;
    out.set(biggest, have - 1);
    given -= 1;
  }

  return out;
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
  const split = shares(counts, blocks);
  const hand: Block[] = [];

  // Sorted by color id so the hand is built in a fixed order; the deal
  // shuffles it afterwards anyway.
  for (const color of [...counts.keys()].sort((a, b) => a - b)) {
    for (const size of cut(counts.get(color) as number, split.get(color) as number, rng)) {
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

  const rules = setting(settingIndex);
  const tiles = [...colorCounts(parsePicture(picture(pictureIndex))).values()].reduce(
    (n, c) => n + c,
    0,
  );
  const target = blocksFor(rules, tiles);

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
