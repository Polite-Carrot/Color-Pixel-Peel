import type { Board } from './board';
import type { ColorId } from './palette';

/**
 * Builds a board from ASCII layer grids, **bottom layer first**.
 *
 * Each layer is a list of row strings; a digit is a color id and `.`
 * means "no layer here". So
 *
 * ```ts
 * boardFrom([
 *   ['00', '00'], // bottom: all color 0
 *   ['1.', '..'], // top: one cell of color 1
 * ]);
 * ```
 *
 * is a 2x2 board where the top-left cell is two layers deep.
 */
export function boardFrom(layers: readonly (readonly string[])[]): Board {
  const first = layers[0];
  if (!first || first.length === 0) throw new Error('boardFrom: need at least one non-empty layer');

  const rows = first.length;
  const cols = (first[0] as string).length;
  const cells: ColorId[][] = Array.from({ length: cols * rows }, () => []);

  for (const layer of layers) {
    if (layer.length !== rows) throw new Error('boardFrom: layers must have equal row counts');
    for (let y = 0; y < rows; y++) {
      const row = layer[y] as string;
      if (row.length !== cols) throw new Error('boardFrom: rows must have equal lengths');
      for (let x = 0; x < cols; x++) {
        const ch = row[x] as string;
        if (ch === '.') continue;
        const color = Number.parseInt(ch, 10);
        if (Number.isNaN(color)) throw new Error(`boardFrom: bad character '${ch}'`);
        (cells[y * cols + x] as ColorId[]).push(color);
      }
    }
  }

  return { cols, rows, cells };
}
