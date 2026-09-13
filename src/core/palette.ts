/**
 * The palette, shared with Color Match & Merge.
 *
 * The hexes and letter marks are lifted from that game's `js/colour.js` so
 * the two read as coming from the same place. Colors never blend here
 * either: a layer keeps the color it was dealt, and a cell is a stack of
 * solid tiles.
 */

/** Indexes into {@link PALETTE}. An empty layer stack means "no color". */
export type ColorId = number;

export interface Swatch {
  hex: string;
  /** Letter drawn on the tile under Color Blind Assist. All marks differ. */
  mark: string;
  /** Player-facing name, US spelling, used for accessibility labels. */
  name: string;
}

/**
 * Ordered primaries-first, matching the three jars on Color Match's
 * masthead.
 *
 * `teal` (#0ec3c6) from the shared palette is deliberately left out. It
 * sits 103 from this list's cyan, below the 150 rule — the palette clash
 * Color Match's README documents as still open. Omitting it means no level
 * here can deal the pair, rather than relying on a generator check.
 */
export const PALETTE: readonly Swatch[] = [
  { hex: '#f5423c', mark: 'R', name: 'red' },
  { hex: '#3b7bf7', mark: 'B', name: 'blue' },
  { hex: '#ffd028', mark: 'Y', name: 'yellow' },
  { hex: '#2fc15e', mark: 'G', name: 'green' },
  { hex: '#9a53ef', mark: 'P', name: 'purple' },
  { hex: '#22c8ff', mark: 'C', name: 'cyan' },
  { hex: '#ff8700', mark: 'O', name: 'orange' },
  { hex: '#ff5aae', mark: 'M', name: 'magenta' },
  { hex: '#fbfdff', mark: 'W', name: 'white' },

  /* Darks and neutrals the liquid palette has none of, borrowed from the
     house tokens so they stay in-family. Pixel art needs an outline color
     and something earthy; a jar of liquid never did. */
  { hex: '#2b2142', mark: 'D', name: 'dark' },
  { hex: '#a86f36', mark: 'T', name: 'tan' },
  { hex: '#8e9bb3', mark: 'S', name: 'slate' },
];

export const MAX_COLORS = PALETTE.length;

/* Named ids, so a picture's legend and a level's blocks read as colors
   rather than as numbers. The order below is the order above. */
export const RED: ColorId = 0;
export const BLUE: ColorId = 1;
export const YELLOW: ColorId = 2;
export const GREEN: ColorId = 3;
export const PURPLE: ColorId = 4;
export const CYAN: ColorId = 5;
export const ORANGE: ColorId = 6;
export const MAGENTA: ColorId = 7;
export const WHITE: ColorId = 8;
export const DARK: ColorId = 9;
export const TAN: ColorId = 10;
export const SLATE: ColorId = 11;

/**
 * How far apart two colors must look before they may share **one
 * picture**. The figure and the measure below both come from Color Match.
 *
 * Per-picture rather than palette-wide, which is how that game enforces
 * it too — its generator applies the rule at deal time so a clashing pair
 * cannot land on one shelf, rather than banning the colors outright. That
 * matters more here: `red` and `tan` sit 142 apart, and losing either from
 * the whole palette would cost more than keeping them off the same
 * artwork. `levels.test.ts` checks every picture.
 */
export const MIN_DISTANCE = 150;

export function swatch(id: ColorId): Swatch {
  const s = PALETTE[id];
  if (!s) throw new Error(`swatch: no color with id ${id}`);
  return s;
}

function rgb(id: ColorId): { r: number; g: number; b: number } {
  const h = swatch(id).hex.replace('#', '');
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Rough perceptual gap between two colors. The channel weights approximate
 * how much each contributes to perceived difference; it exists only so a
 * board never pairs two colors that are hard to tell apart.
 */
export function distance(a: ColorId, b: ColorId): number {
  const x = rgb(a);
  const y = rgb(b);
  const dr = x.r - y.r;
  const dg = x.g - y.g;
  const db = x.b - y.b;
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/**
 * Solid dark or light ink for text sitting ON a color — a block's number,
 * say. The translucent {@link markInk} is right over artwork, where the
 * tile's color should still read through; a number on a chip needs full
 * contrast or it comes out grey.
 */
export function solidInk(id: ColorId): string {
  const c = rgb(id);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.58 ? '#2b2142' : '#fffdf7';
}

/** Dark or light ink for a mark sitting on the tile, by its luminance. */
export function markInk(id: ColorId): string {
  const c = rgb(id);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.58
    ? 'rgba(28, 20, 48, .62)'
    : 'rgba(255, 255, 255, .78)';
}
