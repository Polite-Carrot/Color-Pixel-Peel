import { type Block, block } from './blocks';
import type { PictureSource } from './picture';
import { DARK, MAGENTA, ORANGE, TAN, WHITE } from './palette';

export interface LevelDef {
  /** Shown in the topbar. */
  name: string;
  /** What the picture is, for the briefing line. */
  brief: string;
  picture: PictureSource;
  /** How many blocks the panel can hold at once. */
  slots: number;
  /**
   * The hand for this level, in tray order. The counts add up to the
   * picture's tile counts exactly, so a level is cleared by spending
   * every block — there is nothing spare and nothing missing.
   * `levels.test.ts` checks that, and plays each level through.
   */
  blocks: readonly Block[];
}

export const LEVELS: readonly LevelDef[] = [
  {
    name: 'Good dog',
    brief: 'Play a numbered block into the panel and it takes that many tiles of its color off the picture.',
    picture: {
      rows: [
        '....DD....DD....',
        '...DOOD..DOOD...',
        '...DOTD..DOTD...',
        '..DDOODDDDOODD..',
        '..DOOOOOOOOOOD..',
        '..DOODOOOODOOD..',
        '..DOOOOOOOOOOD..',
        '..DOOWWWWWWOOD..',
        '..DOWWDDDDWWOD..',
        '..DOWWWMMWWWOD..',
        '..DDOWWWWWWODD..',
        '...DDOOOOOODD...',
        '....DDDDDDDD....',
      ],
      legend: { D: DARK, O: ORANGE, T: TAN, W: WHITE, M: MAGENTA },
    },
    slots: 5,
    // dark 54, orange 54, white 22, tan 2, magenta 2 = 134 tiles.
    blocks: [
      block(DARK, 12),
      block(ORANGE, 12),
      block(WHITE, 12),
      block(DARK, 12),
      block(ORANGE, 12),
      block(TAN, 2),
      block(DARK, 12),
      block(ORANGE, 12),
      block(WHITE, 10),
      block(DARK, 12),
      block(ORANGE, 12),
      block(MAGENTA, 2),
      block(DARK, 6),
      block(ORANGE, 6),
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelDef(index: number): LevelDef {
  const def = LEVELS[index - 1];
  if (!def) throw new Error(`levelDef: no level ${index}`);
  return def;
}
