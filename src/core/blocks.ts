import type { ColorId } from './palette';

/**
 * A numbered color block. Playing it into a panel slot takes that many
 * accessible tiles of its color off the picture.
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

/**
 * Deals a level's hand into columns, one block to each column in turn.
 *
 * Only the **front** block of a column can be played, so the deal is what
 * decides which blocks are available when. Round-robin rather than
 * filling one column at a time: dealing column by column would bury a
 * whole run of the hand behind another, and the level author controls
 * what comes up early through the order of the hand itself.
 */
export function dealColumns(blocks: readonly Block[], columns: number): Block[][] {
  if (columns <= 0) throw new Error('dealColumns: need at least one column');

  const dealt: Block[][] = Array.from({ length: columns }, () => []);
  for (const [i, b] of blocks.entries()) {
    (dealt[i % columns] as Block[]).push(b);
  }
  return dealt;
}

/** Every block still in hand, across all columns. */
export function remainingBlocks(columns: readonly (readonly Block[])[]): Block[] {
  return columns.flatMap((column) => [...column]);
}

/** The front block of each column — the only ones that can be played. */
export function frontBlocks(columns: readonly (readonly Block[])[]): (Block | null)[] {
  return columns.map((column) => column[0] ?? null);
}
