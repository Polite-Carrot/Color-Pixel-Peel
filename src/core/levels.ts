import { type Block, block } from './blocks';
import type { PictureSource } from './picture';
import { DARK, GREEN, MAGENTA, ORANGE, RED, TAN, WHITE, YELLOW } from './palette';

export interface LevelDef {
  /** Shown in the topbar. */
  name: string;
  /** What the picture is, for the briefing line. */
  brief: string;
  picture: PictureSource;
  /** How many blocks the panel can hold at once. */
  slots: number;
  /**
   * How many columns the hand is dealt into. Only the front block of each
   * can be played, so this is how much choice the player has at any
   * moment — the tightest constraint in the game.
   */
  columns: number;
  /**
   * The hand for this level, in tray order. The counts add up to the
   * picture's tile counts exactly, so a level is cleared by spending
   * every block — there is nothing spare and nothing missing.
   * `levels.test.ts` checks that, and plays each level through.
   */
  blocks: readonly Block[];
}

/**
 * The levels, easiest first.
 *
 * Difficulty is turned with four things, and deliberately not with luck:
 * how big and how tangled the picture is, how many colors it holds, how
 * many slots the panel gives you to park a mistimed block in, and how
 * many columns the hand is dealt into — which is how many blocks are
 * reachable at any moment.
 *
 * The first two are meant to be walked through. After that the picture
 * buries more of itself, so the order blocks come up in starts to matter.
 */
export const LEVELS: readonly LevelDef[] = [
  {
    name: 'Heart',
    brief: 'Play a block into the panel and it takes that many tiles of its color — but only ones the picture has opened up. Start at the edges.',
    picture: {
      rows: [
        '.DD..DD.',
        'DRRDDRRD',
        'DRRRRRRD',
        'DRRRRRRD',
        '.DRRRRD.',
        '..DRRD..',
        '...DD...',
      ],
      legend: { D: DARK, R: RED },
    },
    slots: 5,
    columns: 3,
    // dark 18, red 22 = 40 tiles.
    blocks: [
      block(DARK, 5),
      block(RED, 5),
      block(DARK, 5),
      block(RED, 5),
      block(DARK, 5),
      block(RED, 5),
      block(DARK, 3),
      block(RED, 5),
      block(RED, 2),
    ],
  },

  {
    name: 'Star',
    brief: 'Only tiles the picture has opened up can be taken — start at the edges and work in.',
    picture: {
      rows: [
        '....D....',
        '...DYD...',
        '...DYD...',
        'DDDDYDDDD',
        '.DYYYYYD.',
        '..DYYYD..',
        '.DYYDYYD.',
        'DYD...DYD',
        'D.......D',
      ],
      legend: { D: DARK, Y: YELLOW },
    },
    slots: 5,
    columns: 3,
    // dark 26, yellow 17 = 43 tiles.
    blocks: [
      block(DARK, 6),
      block(YELLOW, 6),
      block(DARK, 6),
      block(YELLOW, 6),
      block(DARK, 6),
      block(YELLOW, 5),
      block(DARK, 6),
      block(DARK, 2),
    ],
  },

  {
    name: 'Good dog',
    brief: 'A block with nothing showing waits in its slot. Fill every slot with those and there is no way on.',
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
    columns: 3,
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

  {
    name: 'Cat',
    brief: 'Four columns now, and only the front of each can be played. Watch what is queued behind.',
    picture: {
      rows: [
        '..DD......DD..',
        '..DGD....DGD..',
        '..DGGD..DGGD..',
        '.DDGGGDDGGGDD.',
        '.DGGGGGGGGGGD.',
        'DGGGDGGGGDGGGD',
        'DGGGDGGGGDGGGD',
        'DGGGGGGGGGGGGD',
        'DGGWWWMMWWGGGD',
        'DGGWWWWWWWGGGD',
        '.DGGWWWWWGGGD.',
        '..DDGGGGGGDD..',
        '....DDDDDD....',
      ],
      legend: { D: DARK, G: GREEN, W: WHITE, M: MAGENTA },
    },
    slots: 4,
    columns: 4,
    // dark 46, green 75, white 17, magenta 2 = 140 tiles.
    blocks: [
      block(GREEN, 8),
      block(DARK, 8),
      block(WHITE, 8),
      block(GREEN, 8),
      block(DARK, 8),
      block(GREEN, 8),
      block(WHITE, 7),
      block(DARK, 8),
      block(GREEN, 8),
      block(MAGENTA, 2),
      block(GREEN, 8),
      block(DARK, 8),
      block(GREEN, 8),
      block(WHITE, 2),
      block(GREEN, 8),
      block(DARK, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(DARK, 6),
      block(GREEN, 3),
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelDef(index: number): LevelDef {
  const def = LEVELS[index - 1];
  if (!def) throw new Error(`levelDef: no level ${index}`);
  return def;
}
