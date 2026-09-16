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
 * The blocks get *smaller* as it gets harder, so there are more of them:
 * a picture cut into fours takes many more plays than the same picture
 * cut into twelves, and every play is another chance to spend a block on
 * a color the picture has not opened up yet. Slots tighten at the same
 * time, so there is less room to park one that cannot move.
 */
export interface Setting {
  name: string;
  /** Smallest block the partitioner aims for. */
  blockMin: number;
  /** Largest block it will cut. */
  blockMax: number;
  slots: number;
  columns: number;
}

export const SETTINGS: readonly Setting[] = [
  { name: 'Gentle', blockMin: 8, blockMax: 14, slots: 5, columns: 3 },
  { name: 'Easy', blockMin: 6, blockMax: 11, slots: 5, columns: 4 },
  { name: 'Normal', blockMin: 5, blockMax: 9, slots: 4, columns: 4 },
  { name: 'Hard', blockMin: 4, blockMax: 7, slots: 3, columns: 4 },
  { name: 'Expert', blockMin: 3, blockMax: 5, slots: 2, columns: 5 },
];

export const SETTING_COUNT = SETTINGS.length;

export function setting(index: number): Setting {
  const found = SETTINGS[index];
  if (!found) throw new Error(`setting: no setting at index ${index}`);
  return found;
}

/**
 * Cuts `total` tiles of one color into blocks inside the setting's size
 * band, summing to exactly `total`.
 *
 * Exactness is the whole game: spend every block and the picture is
 * clear, with nothing spare and nothing missing. So the last cut takes
 * whatever is left even if that is under `blockMin` — a color with three
 * tiles has to become a block of three whatever the setting says.
 */
function cut(total: number, min: number, max: number, rng: { int(n: number): number }): number[] {
  const out: number[] = [];
  let left = total;

  while (left > 0) {
    if (left <= max) {
      out.push(left);
      break;
    }
    /* Never leave a remainder too small to be worth a block of its own:
       the most this may take is what keeps `min` behind. */
    const hi = Math.min(max, left - min);
    const lo = Math.min(min, hi);
    const take = lo + rng.int(hi - lo + 1);
    out.push(take);
    left -= take;
  }

  return out;
}

/** Builds one level, without checking whether it can be won. */
function deal(pictureIndex: number, settingIndex: number, seed: number): LevelDef {
  const art = picture(pictureIndex);
  const rules = setting(settingIndex);
  const rng = createRng(seed);

  const counts = colorCounts(parsePicture(art));
  const blocks: Block[] = [];

  // Sorted by color id so the hand is built in a fixed order; the deal
  // shuffles it afterwards anyway.
  for (const color of [...counts.keys()].sort((a, b) => a - b)) {
    for (const count of cut(counts.get(color) as number, rules.blockMin, rules.blockMax, rng)) {
      blocks.push(block(color, count));
    }
  }

  return {
    name: art.name,
    brief: brief(rules, blocks.length),
    picture: art,
    slots: rules.slots,
    columns: rules.columns,
    seed,
    blocks,
  };
}

function brief(rules: Setting, blocks: number): string {
  return (
    `${rules.name} — ${blocks} blocks, ${rules.slots} slot${rules.slots === 1 ? '' : 's'}. ` +
    'Only tiles the picture has opened up can be taken.'
  );
}

/** How many reseeds to try before giving up on a picture and setting. */
const ATTEMPTS = 40;

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

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const level = deal(pictureIndex, settingIndex, seed + attempt);

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
