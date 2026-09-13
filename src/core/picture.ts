import type { ColorId } from './palette';

/**
 * A picture is the level's artwork: a grid of colored tiles that reads as
 * a simple image rather than as a random board.
 *
 * It is authored as ASCII with a legend, so the file shows the picture:
 *
 * ```ts
 * { rows: ['.OO.', 'OWWO'], legend: { O: ORANGE, W: WHITE } }
 * ```
 *
 * `.` (and any space) is background — no tile there at all, which is what
 * gives the artwork its outline.
 */
export interface PictureSource {
  rows: readonly string[];
  legend: Readonly<Record<string, ColorId>>;
}

export const BACKGROUND = '.';

export interface ParsedPicture {
  cols: number;
  rows: number;
  /** Row-major; `null` is background. */
  tiles: (ColorId | null)[];
}

export function parsePicture(source: PictureSource): ParsedPicture {
  const rowCount = source.rows.length;
  if (rowCount === 0) throw new Error('parsePicture: needs at least one row');

  const cols = (source.rows[0] as string).length;
  if (cols === 0) throw new Error('parsePicture: rows cannot be empty');

  const tiles: (ColorId | null)[] = [];

  for (const [y, row] of source.rows.entries()) {
    if (row.length !== cols) {
      throw new Error(`parsePicture: row ${y} is ${row.length} wide, expected ${cols}`);
    }
    for (const char of row) {
      if (char === BACKGROUND || char === ' ') {
        tiles.push(null);
        continue;
      }
      const color = source.legend[char];
      if (color === undefined) {
        throw new Error(`parsePicture: '${char}' is not in the legend`);
      }
      tiles.push(color);
    }
  }

  return { cols, rows: rowCount, tiles };
}

/** How many tiles of each color the picture holds. */
export function colorCounts(picture: ParsedPicture): Map<ColorId, number> {
  const counts = new Map<ColorId, number>();
  for (const tile of picture.tiles) {
    if (tile === null) continue;
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  return counts;
}
