import type { Block } from './blocks';
import { SETTING_COUNT, generateLevel, setting } from './generator';
import type { PictureSource } from './picture';
import { PICTURE_COUNT, picture } from './pictures';

export interface LevelDef {
  /** Shown in the topbar — the picture's name. */
  name: string;
  /** What this level is, for the briefing line. */
  brief: string;
  picture: PictureSource;
  /** How many blocks the panel can hold at once. */
  slots: number;
  /**
   * How many columns the hand is dealt into. Only the front block of each
   * can be played, so this is how much choice the player has at any
   * moment.
   */
  columns: number;
  /** Seeds the shuffle that deals the hand into columns. */
  seed: number;
  /**
   * The hand. The counts add up to the picture's tile counts exactly, so
   * a level is cleared by spending every block — nothing spare, nothing
   * missing.
   */
  blocks: readonly Block[];
}

/**
 * The campaign: every picture at every setting.
 *
 * A level is a picture, a setting and a seed and nothing else, so the
 * ladder is arithmetic rather than a table. The settings sweep on the
 * outside and the pictures on the inside, so the whole library is played
 * at Gentle before any of it is played at Easy — and each picture comes
 * back four more times, cut into smaller and smaller blocks with fewer
 * slots to work in.
 *
 * Adding a picture therefore adds one level per setting, and the count
 * below moves on its own.
 */
export const LEVEL_COUNT = PICTURE_COUNT * SETTING_COUNT;

interface CampaignRow {
  pictureIndex: number;
  settingIndex: number;
  seed: number;
}

function row(index: number): CampaignRow {
  if (index < 1 || index > LEVEL_COUNT) throw new Error(`levelDef: no level ${index}`);

  const zero = index - 1;
  const settingIndex = Math.floor(zero / PICTURE_COUNT);
  const pictureIndex = zero % PICTURE_COUNT;

  /* A seed of its own per level, spread far enough apart that the
     generator's reseeding on a failed deal cannot walk into the next
     level's seed and deal the same hand twice. */
  return { pictureIndex, settingIndex, seed: index * 7919 };
}

/** Name and setting for a level, without dealing its hand. */
export interface LevelSummary {
  index: number;
  name: string;
  setting: string;
}

export function levelSummary(index: number): LevelSummary {
  const { pictureIndex, settingIndex } = row(index);
  return {
    index,
    name: picture(pictureIndex).name,
    setting: setting(settingIndex).name,
  };
}

export function levelSummaries(): LevelSummary[] {
  return Array.from({ length: LEVEL_COUNT }, (_, i) => levelSummary(i + 1));
}

/* Dealing a level plays it through to prove it can be won, so it is worth
   keeping the answer rather than doing it again every time the player
   restarts. */
const dealt = new Map<number, LevelDef>();

export function levelDef(index: number): LevelDef {
  const cached = dealt.get(index);
  if (cached) return cached;

  const { pictureIndex, settingIndex, seed } = row(index);
  const level = generateLevel(pictureIndex, settingIndex, seed);
  dealt.set(index, level);
  return level;
}
