/**
 * Color identity for a pixel layer. Indexes into PALETTE; -1 is never a
 * valid color (use an empty layer stack to mean "nothing here").
 */
export type ColorId = number;

export interface Swatch {
  /** Fill for the top-most layer. */
  hex: string;
  /** Darker edge, used for the stacked-layer shading. */
  shadeHex: string;
  /** Human-readable name, used for accessibility labels. */
  name: string;
  /**
   * Glyph drawn on the tile when symbol mode is on, so colors stay
   * distinguishable without relying on hue alone.
   */
  symbol: string;
}

/**
 * Ordered so that any prefix of the list stays mutually distinguishable —
 * early levels use only the first few entries. Hues are spread and paired
 * with distinct symbols for color-vision deficiency.
 */
export const PALETTE: readonly Swatch[] = [
  { hex: '#f4645f', shadeHex: '#b93c38', name: 'red', symbol: '●' },
  { hex: '#4da3ff', shadeHex: '#2a6bb5', name: 'blue', symbol: '▲' },
  { hex: '#ffc24d', shadeHex: '#c08a24', name: 'amber', symbol: '■' },
  { hex: '#54d98c', shadeHex: '#2e9760', name: 'green', symbol: '◆' },
  { hex: '#b98cff', shadeHex: '#7d57c2', name: 'violet', symbol: '✦' },
  { hex: '#ff9de0', shadeHex: '#c065a5', name: 'pink', symbol: '✚' },
  { hex: '#4ad9d9', shadeHex: '#249a9a', name: 'teal', symbol: '⬟' },
];

export const MAX_COLORS = PALETTE.length;

export function swatch(id: ColorId): Swatch {
  const s = PALETTE[id];
  if (!s) throw new Error(`swatch: no color with id ${id}`);
  return s;
}
