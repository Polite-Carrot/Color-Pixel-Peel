import { type Block, block } from './blocks';
import type { PictureSource } from './picture';
import { BLUE, CYAN, DARK, GREEN, MAGENTA, ORANGE, PURPLE, RED, TAN, WHITE, YELLOW } from './palette';

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
   * Seeds the shuffle that deals the hand into columns. Fixed per level so
   * everyone gets the same deal, and here rather than derived so a level
   * whose deal turns out awkward can be re-dealt without touching
   * anything else.
   */
  seed: number;
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
/**
 * The levels, easiest first.
 *
 * Difficulty is turned with four things, and deliberately not with luck:
 * how big and how tangled the picture is, how many colors it holds, how
 * many **slots** the panel gives you to park a block that cannot move
 * yet, and how many columns the hand is dealt into.
 *
 * Slots are the sharp one. Every picture here is drawn with an outline,
 * and an outline encloses its own fill — so most colors start unreachable
 * and a block spent on one sits in a slot until the outline comes off.
 * Five slots forgives that freely; the last level gives two.
 */
export const LEVELS: readonly LevelDef[] = [
  {
    name: 'Heart',
    brief:
      'Play a block into the panel and it takes that many tiles of its color — but only ones the picture has opened up. Start at the edges.',
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
    seed: 1013,
    // dark 18, red 22 = 40 tiles.
    blocks: [
      block(DARK, 5),
      block(DARK, 5),
      block(DARK, 5),
      block(DARK, 3),
      block(RED, 5),
      block(RED, 5),
      block(RED, 5),
      block(RED, 5),
      block(RED, 2),
    ],
  },

  {
    name: 'Star',
    brief:
      'Only tiles the picture has opened up can be taken — work in from the edges.',
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
    seed: 2026,
    // dark 26, yellow 17 = 43 tiles.
    blocks: [
      block(DARK, 6),
      block(DARK, 6),
      block(DARK, 6),
      block(DARK, 6),
      block(DARK, 2),
      block(YELLOW, 6),
      block(YELLOW, 6),
      block(YELLOW, 5),
    ],
  },

  {
    name: 'Fish',
    brief:
      'A block counts down half a second at a time. Play another while it runs and both eat the picture at once.',
    picture: {
      rows: [
        '....DDDDDD....',
        '..DDOOOOOODD..',
        '.DOOOOOOOOOODD',
        'DOWWOOOOOOOOOD',
        'DOWWOOOOOOOODD',
        'DOOOOOOOOOOOOD',
        '.DOOOOOOOOOODD',
        '..DDOOOOOODD..',
        '....DDDDDD....',
      ],
      legend: { D: DARK, O: ORANGE, W: WHITE },
    },
    slots: 5,
    columns: 3,
    seed: 3039,
    // dark 33, orange 63, white 4 = 100 tiles.
    blocks: [
      block(DARK, 8),
      block(DARK, 8),
      block(DARK, 8),
      block(DARK, 7),
      block(DARK, 2),
      block(ORANGE, 8),
      block(ORANGE, 8),
      block(ORANGE, 8),
      block(ORANGE, 8),
      block(ORANGE, 8),
      block(ORANGE, 8),
      block(ORANGE, 8),
      block(ORANGE, 7),
      block(WHITE, 4),
    ],
  },

  {
    name: 'Rocket',
    brief:
      'A block with nothing to take waits in its slot until something opens its color up. One fewer slot to park it in now.',
    picture: {
      rows: [
        '.....DD.....',
        '....DWWD....',
        '...DWWWWD...',
        '...DWCCWD...',
        '...DWCCWD...',
        '...DWWWWD...',
        '..DWWWWWWD..',
        '.DMWWWWWWMD.',
        'DMMWWWWWWMMD',
        'DMMDWWWWDMMD',
        '.DDDWWWWDDD.',
        '....DOOD....',
        '...DOOOOD...',
        '...DOYYOD...',
        '....DOOD....',
        '.....DD.....',
      ],
      legend: { C: CYAN, D: DARK, M: MAGENTA, O: ORANGE, W: WHITE, Y: YELLOW },
    },
    slots: 4,
    columns: 4,
    seed: 4052,
    // cyan 4, dark 38, magenta 10, orange 10, white 40, yellow 2 = 104 tiles.
    blocks: [
      block(CYAN, 4),
      block(DARK, 10),
      block(DARK, 10),
      block(DARK, 10),
      block(DARK, 8),
      block(MAGENTA, 10),
      block(ORANGE, 10),
      block(WHITE, 10),
      block(WHITE, 10),
      block(WHITE, 10),
      block(WHITE, 10),
      block(YELLOW, 2),
    ],
  },

  {
    name: 'House',
    brief:
      'Five colors, and most of them sealed behind the outline. Open it before you spend them.',
    picture: {
      rows: [
        '.......D.......',
        '......DRD......',
        '.....DRRRD.....',
        '....DRRRRRD....',
        '...DRRRRRRRD...',
        '..DRRRRRRRRRD..',
        '.DDDDDDDDDDDDD.',
        '.DYYYYYYYYYYYD.',
        '.DYBBYYYYYBBYD.',
        '.DYBBYYYYYBBYD.',
        '.DYYYYWWWYYYYD.',
        '.DYYYYWWWYYYYD.',
        '.DDDDDDDDDDDDD.',
      ],
      legend: { B: BLUE, D: DARK, R: RED, W: WHITE, Y: YELLOW },
    },
    slots: 4,
    columns: 4,
    seed: 5065,
    // blue 8, dark 47, red 25, white 6, yellow 41 = 127 tiles.
    blocks: [
      block(BLUE, 8),
      block(DARK, 10),
      block(DARK, 10),
      block(DARK, 10),
      block(DARK, 10),
      block(DARK, 7),
      block(RED, 10),
      block(RED, 10),
      block(RED, 5),
      block(WHITE, 6),
      block(YELLOW, 10),
      block(YELLOW, 10),
      block(YELLOW, 10),
      block(YELLOW, 9),
      block(YELLOW, 2),
    ],
  },

  {
    name: 'Good dog',
    brief:
      'Watch what is queued behind each front block — you can only ever play the one at the front.',
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
      legend: { D: DARK, M: MAGENTA, O: ORANGE, T: TAN, W: WHITE },
    },
    slots: 4,
    columns: 4,
    seed: 6078,
    // dark 54, magenta 2, orange 54, tan 2, white 22 = 134 tiles.
    blocks: [
      block(DARK, 12),
      block(DARK, 12),
      block(DARK, 12),
      block(DARK, 12),
      block(DARK, 6),
      block(MAGENTA, 2),
      block(ORANGE, 12),
      block(ORANGE, 12),
      block(ORANGE, 12),
      block(ORANGE, 12),
      block(ORANGE, 6),
      block(TAN, 2),
      block(WHITE, 12),
      block(WHITE, 10),
    ],
  },

  {
    name: 'Cat',
    brief:
      'Three slots. Two blocks that cannot move leaves you one, and a third leaves you nowhere.',
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
      legend: { D: DARK, G: GREEN, M: MAGENTA, W: WHITE },
    },
    slots: 3,
    columns: 4,
    seed: 7091,
    // dark 46, green 75, magenta 2, white 17 = 140 tiles.
    blocks: [
      block(DARK, 8),
      block(DARK, 8),
      block(DARK, 8),
      block(DARK, 8),
      block(DARK, 8),
      block(DARK, 6),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 8),
      block(GREEN, 3),
      block(MAGENTA, 2),
      block(WHITE, 8),
      block(WHITE, 7),
      block(WHITE, 2),
    ],
  },

  {
    name: 'Butterfly',
    brief:
      'Bigger blocks tie a slot up for longer. Spend them on colors the picture can actually reach.',
    picture: {
      rows: [
        '..DDD.......DDD..',
        '.DMMMDD...DDMMMD.',
        'DMMMMMMD.DMMMMMMD',
        'DMMPPMMMDMMMPPMMD',
        'DMMPPMMMDMMMPPMMD',
        'DMMMMMMMDMMMMMMMD',
        '.DMMMMMMDMMMMMMD.',
        '..DDMMMMDMMMMDD..',
        '....DMMMDMMMD....',
        '...DCCMMDMMCCD...',
        '...DCCCMDMCCCD...',
        '....DCCCDCCCD....',
        '.....DCCDCCD.....',
        '......DDDDD......',
        '.......DDD.......',
      ],
      legend: { C: CYAN, D: DARK, M: MAGENTA, P: PURPLE },
    },
    slots: 3,
    columns: 5,
    seed: 8104,
    // cyan 20, dark 56, magenta 84, purple 8 = 168 tiles.
    blocks: [
      block(CYAN, 14),
      block(CYAN, 6),
      block(DARK, 14),
      block(DARK, 14),
      block(DARK, 14),
      block(DARK, 14),
      block(MAGENTA, 14),
      block(MAGENTA, 14),
      block(MAGENTA, 14),
      block(MAGENTA, 14),
      block(MAGENTA, 14),
      block(MAGENTA, 14),
      block(PURPLE, 8),
    ],
  },

  {
    name: 'Owl',
    brief:
      'Two slots, and a picture that hides nearly all of itself. Every block you play is a commitment.',
    picture: {
      rows: [
        '..DD........DD..',
        '.DTTD......DTTD.',
        '.DTTTDDDDDDTTTD.',
        'DTTTTTTTTTTTTTTD',
        'DTTWWWWTTWWWWTTD',
        'DTTWYYWTTWYYWTTD',
        'DTTWYYWTTWYYWTTD',
        'DTTWWWWTTWWWWTTD',
        'DTTTTTOOTTTTTTTD',
        'DTTTTTOOTTTTTTTD',
        '.DTTTTTTTTTTTTD.',
        '.DTTTTTTTTTTTTD.',
        '..DTTTTTTTTTTD..',
        '...DDDDDDDDDD...',
      ],
      legend: { D: DARK, O: ORANGE, T: TAN, W: WHITE, Y: YELLOW },
    },
    slots: 2,
    columns: 5,
    seed: 9117,
    // dark 46, orange 4, tan 106, white 24, yellow 8 = 188 tiles.
    blocks: [
      block(DARK, 12),
      block(DARK, 12),
      block(DARK, 12),
      block(DARK, 10),
      block(ORANGE, 4),
      block(TAN, 12),
      block(TAN, 12),
      block(TAN, 12),
      block(TAN, 12),
      block(TAN, 12),
      block(TAN, 12),
      block(TAN, 12),
      block(TAN, 12),
      block(TAN, 10),
      block(WHITE, 12),
      block(WHITE, 12),
      block(YELLOW, 8),
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelDef(index: number): LevelDef {
  const def = LEVELS[index - 1];
  if (!def) throw new Error(`levelDef: no level ${index}`);
  return def;
}
