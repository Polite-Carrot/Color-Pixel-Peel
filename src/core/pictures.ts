import type { PictureSource } from './picture';
import { BLUE, CYAN, DARK, GREEN, MAGENTA, ORANGE, PURPLE, RED, TAN, WHITE, YELLOW } from './palette';

/**
 * The picture library.
 *
 * A level is a picture, a setting and a seed — nothing else — so this is
 * the only place artwork lives, and the generator builds every level in
 * the campaign out of it. Adding a picture here adds one level per
 * setting, so the campaign grows five at a time.
 *
 * Ordered smallest first, which is the order the campaign sweeps them in.
 *
 * Two rules the build script checks rather than trusting: every row of a
 * picture is the same width, and no picture pairs `red` with `tan` — they
 * sit 142 apart on the distance measure, under the 150 a player needs to
 * tell two colors apart.
 */
export interface LibraryPicture extends PictureSource {
  name: string;
}

export const PICTURES: readonly LibraryPicture[] = [
  {
    name: 'Heart',
    // 8x7, 40 tiles, 2 colors
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

  {
    name: 'Star',
    // 9x9, 43 tiles, 2 colors
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

  {
    name: 'Apple',
    // 10x11, 78 tiles, 4 colors
    rows: [
      '.....DD...',
      '....DGGD..',
      '..DDDRDD..',
      '.DRRRRRRD.',
      'DRRWRRRRRD',
      'DRRWRRRRRD',
      'DRRRRRRRRD',
      'DRRRRRRRRD',
      '.DRRRRRRD.',
      '..DRRRRD..',
      '...DDDD...',
    ],
    legend: { D: DARK, G: GREEN, R: RED, W: WHITE },
  },

  {
    name: 'Balloon',
    // 10x14, 77 tiles, 3 colors
    rows: [
      '...DDDD...',
      '..DMMMMD..',
      '.DMMMMMMD.',
      'DMMMWMMMMD',
      'DMMMWMMMMD',
      'DMMMMMMMMD',
      '.DMMMMMMD.',
      '..DMMMMD..',
      '...DMMD...',
      '....DD....',
      '....DD....',
      '...DDD....',
      '....DD....',
      '....DD....',
    ],
    legend: { D: DARK, M: MAGENTA, W: WHITE },
  },

  {
    name: 'Tree',
    // 11x13, 83 tiles, 3 colors
    rows: [
      '....DDD....',
      '...DGGGD...',
      '..DGGGGGD..',
      '.DGGGGGGGD.',
      'DGGGGGGGGGD',
      '.DGGGGGGGD.',
      '..DGGGGGD..',
      '.DGGGGGGGD.',
      '..DGGGGGD..',
      '...DDTDD...',
      '....DTD....',
      '....DTD....',
      '...DDDDD...',
    ],
    legend: { D: DARK, G: GREEN, T: TAN },
  },

  {
    name: 'Cup',
    // 12x10, 93 tiles, 3 colors
    rows: [
      '.DDDDDDDDD..',
      '.DWWWWWWWD..',
      '.DWCCCCCWDD.',
      '.DWCCCCCWDWD',
      '.DWCCCCCWDWD',
      '.DWCCCCCWDDD',
      '.DWCCCCCWD..',
      '.DWCCCCCWD..',
      '..DWWWWWD...',
      '..DDDDDDD...',
    ],
    legend: { C: CYAN, D: DARK, W: WHITE },
  },

  {
    name: 'Ghost',
    // 10x11, 95 tiles, 3 colors
    rows: [
      '...DDDD...',
      '..DWWWWD..',
      '.DWWWWWWD.',
      'DWWDWWDWWD',
      'DWWDWWDWWD',
      'DWWWWWWWWD',
      'DWWWWWWWWD',
      'DWWMMMMWWD',
      'DWWWWWWWWD',
      'DWDWWDWWDD',
      'DDD.DD.DD.',
    ],
    legend: { D: DARK, M: MAGENTA, W: WHITE },
  },

  {
    name: 'Key',
    // 13x9, 68 tiles, 2 colors
    rows: [
      '..DDDD.......',
      '.DYYYYD......',
      'DYYDDYYDDDDD.',
      'DYD..DYYYYYYD',
      'DYD..DYDDDYDD',
      'DYYDDYYDDDYD.',
      '.DYYYYD...DD.',
      '..DDDD.......',
      '.............',
    ],
    legend: { D: DARK, Y: YELLOW },
  },

  {
    name: 'Fish',
    // 14x9, 100 tiles, 3 colors
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

  {
    name: 'Rocket',
    // 12x16, 104 tiles, 6 colors
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

  {
    name: 'Mushroom',
    // 13x12, 104 tiles, 3 colors
    rows: [
      '...DDDDDD....',
      '..DRRRRRRD...',
      '.DRRWRRRRRD..',
      'DRRRRRRWRRRD.',
      'DRWRRRRRRRRD.',
      'DRRRRRWRRRRD.',
      '.DDDDDDDDDD..',
      '...DWWWWD....',
      '...DWWWWD....',
      '...DWWWWD....',
      '..DDWWWWDD...',
      '..DDDDDDDD...',
    ],
    legend: { D: DARK, R: RED, W: WHITE },
  },

  {
    name: 'Crown',
    // 14x10, 102 tiles, 3 colors
    rows: [
      'D....DD....D..',
      'DD..DYYD..DD..',
      'DYD.DYYD.DYD..',
      'DYYDDYYDDYYD..',
      'DYYYYYYYYYYD..',
      'DYYYCYYCYYYD..',
      'DYYYYYYYYYYD..',
      'DDDDDDDDDDDD..',
      '.DYYYYYYYYD...',
      '.DDDDDDDDDD...',
    ],
    legend: { C: CYAN, D: DARK, Y: YELLOW },
  },

  {
    name: 'Flower',
    // 13x13, 71 tiles, 4 colors
    rows: [
      '....DDD......',
      '...DMMMD.....',
      '..DMMMMMD....',
      '.DMMMYMMMD...',
      '.DMMYYYMMD...',
      '..DMMYMMD....',
      '...DMMMD.....',
      '....DGD......',
      '...DGGGD.....',
      '..DGDGDGD....',
      '.DGD.G.DGD...',
      '.....G.......',
      '....DDD......',
    ],
    legend: { D: DARK, G: GREEN, M: MAGENTA, Y: YELLOW },
  },

  {
    name: 'House',
    // 15x13, 127 tiles, 5 colors
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

  {
    name: 'Good dog',
    // 16x13, 134 tiles, 5 colors
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

  {
    name: 'Boat',
    // 15x11, 84 tiles, 3 colors
    rows: [
      '......DD.......',
      '......DWD......',
      '......DWWD.....',
      '......DWWWD....',
      '......DWWWWD...',
      '......DDDDDD...',
      'DDDDDDDDDDDDDD.',
      'DWWWWWWWWWWWWD.',
      '.DWWWWWWWWWWD..',
      '..DDDDDDDDDD...',
      '...DCCCCCCD....',
    ],
    legend: { C: CYAN, D: DARK, W: WHITE },
  },

  {
    name: 'Cat',
    // 14x13, 140 tiles, 4 colors
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

  {
    name: 'Cake',
    // 15x12, 120 tiles, 4 colors
    rows: [
      '...D..D..D.....',
      '...D..D..D.....',
      '..DDDDDDDD.....',
      '.DWWWWWWWWD....',
      'DMMMMMMMMMMD...',
      'DMMMMMMMMMMD...',
      'DDDDDDDDDDDD...',
      'DWWWWWWWWWWD...',
      'DWWWWWWWWWWD...',
      'DDDDDDDDDDDD...',
      'DCCCCCCCCCCD...',
      'DDDDDDDDDDDD...',
    ],
    legend: { C: CYAN, D: DARK, M: MAGENTA, W: WHITE },
  },

  {
    name: 'Butterfly',
    // 17x15, 168 tiles, 4 colors
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

  {
    name: 'Owl',
    // 16x14, 188 tiles, 5 colors
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
];

export const PICTURE_COUNT = PICTURES.length;

export function picture(index: number): LibraryPicture {
  const found = PICTURES[index];
  if (!found) throw new Error(`picture: no picture at index ${index}`);
  return found;
}
