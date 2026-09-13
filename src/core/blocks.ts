import type { ColorId } from './palette';
import { createRng } from './rng';

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
 * How many shuffles to try before keeping the best one. Small because the
 * scoring below rejects the bad cases quickly; the point is only to avoid
 * a column that is all one color.
 */
const DEAL_ATTEMPTS = 40;

/**
 * How badly a deal clumps. Lower is better.
 *
 * Three things count, and the third was learned the hard way. Dealing
 * only for variety *down* each column left a deal whose three front
 * blocks were all red — on a picture whose red is walled in by its own
 * outline, so the opening move could not take anything at all and three
 * slots had to be spent finding that out. A row of the same color is
 * worse than a column of it, and the front row is the worst of all.
 */
function clumpScore(columns: readonly (readonly Block[])[]): number {
  let score = 0;

  for (const column of columns) {
    for (let i = 1; i < column.length; i++) {
      if ((column[i] as Block).color === (column[i - 1] as Block).color) score += 1;
    }
    if (column.length > 1 && new Set(column.map((b) => b.color)).size === 1) score += 10;
  }

  const deepest = Math.max(0, ...columns.map((c) => c.length));
  for (let rank = 0; rank < deepest; rank++) {
    const row = columns.map((c) => c[rank]).filter((b): b is Block => b !== undefined);
    if (row.length < 2) continue;

    const seen = new Map<number, number>();
    for (const b of row) seen.set(b.color, (seen.get(b.color) ?? 0) + 1);

    let duplicates = 0;
    for (const n of seen.values()) duplicates += n - 1;

    // The front row is what the player is offered first, so a lack of
    // choice there costs most.
    score += duplicates * (rank === 0 ? 8 : 2);
  }

  return score;
}

function roundRobin(blocks: readonly Block[], columns: number): Block[][] {
  const dealt: Block[][] = Array.from({ length: columns }, () => []);
  for (const [i, b] of blocks.entries()) (dealt[i % columns] as Block[]).push(b);
  return dealt;
}

/**
 * Deals a level's hand into columns.
 *
 * Only the **front** block of a column can be played, so the deal decides
 * which blocks are available when. The hand is shuffled from the level's
 * seed first — dealing it in the order written put runs of one color into
 * one column, and a column of nothing but dark is a column that does
 * nothing whenever dark is buried.
 *
 * Several shuffles are tried and the least clumped kept, so the result is
 * mixed rather than merely random. It is all driven from the seed, so the
 * deal is the same for every player and the tests play the real one.
 */
export function dealColumns(blocks: readonly Block[], columns: number, seed = 1): Block[][] {
  if (columns <= 0) throw new Error('dealColumns: need at least one column');

  const rng = createRng(seed);
  let best: Block[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < DEAL_ATTEMPTS; attempt++) {
    const dealt = roundRobin(rng.shuffle([...blocks]), columns);
    const score = clumpScore(dealt);
    if (score < bestScore) {
      best = dealt;
      bestScore = score;
      if (score === 0) break;
    }
  }

  return best ?? roundRobin(blocks, columns);
}

/** Every block still in hand, across all columns. */
export function remainingBlocks(columns: readonly (readonly Block[])[]): Block[] {
  return columns.flatMap((column) => [...column]);
}

/** The front block of each column — the only ones that can be played. */
export function frontBlocks(columns: readonly (readonly Block[])[]): (Block | null)[] {
  return columns.map((column) => column[0] ?? null);
}
