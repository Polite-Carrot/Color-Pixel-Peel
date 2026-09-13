import type { ColorId } from './palette';

/**
 * A numbered color block from the tray. Playing it into a panel slot
 * takes that many accessible tiles of its color off the picture.
 */
export interface Block {
  readonly color: ColorId;
  readonly count: number;
}

export function block(color: ColorId, count: number): Block {
  if (count <= 0) throw new Error('block: count must be positive');
  return { color, count };
}

/** Total tiles a set of blocks can take, per color. */
export function blockTotals(blocks: readonly Block[]): Map<ColorId, number> {
  const totals = new Map<ColorId, number>();
  for (const b of blocks) totals.set(b.color, (totals.get(b.color) ?? 0) + b.count);
  return totals;
}
