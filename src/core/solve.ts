import { Game, TILE_INTERVAL_MS } from './game';
import type { LevelDef } from './levels';

export interface Playthrough {
  won: boolean;
  /** Blocks played. */
  plays: number;
  /** The most slots occupied at once — how close it came to jamming. */
  peakSlots: number;
  /** Plays made with nothing reachable, which strand a block in a slot. */
  strandedPlays: number;
  /** Tiles still on the picture when it ended. */
  tilesLeft: number;
}

const GUARD = 20_000;

/**
 * Plays a level the way a reasonable player would, and reports how it
 * went.
 *
 * The strategy is deliberately simple: fill any free slot with the
 * biggest block whose color has tiles showing, and only strand one when
 * there is nothing better on offer *and nothing left to wait for*. Then
 * let the clock run so the panel drains.
 *
 * That second condition matters more than it looks. Committing a slot to
 * a color the picture has not opened is irreversible; waiting for a block
 * already in the panel to finish costs nothing and may open that very
 * color. A solver that stranded eagerly called the Deer at Hard
 * unwinnable when it is not.
 *
 * "Something to wait for" has to mean a slot that is actually **eating**,
 * not merely one that still owes tiles. A slot holding a color the
 * picture has sealed owes tiles it will never be paid, and waiting on
 * that is waiting forever — the loop below would spin out its whole guard
 * on every failed deal.
 *
 * It only ever chooses between the **fronts** of the columns, because
 * that is the choice a player actually has. A level the generator cannot
 * win this way is not shipped — see `generator.ts`.
 *
 * `peakSlots` and `strandedPlays` are what make it useful beyond a
 * yes/no: they say how much room a level leaves, which is the difference
 * between a level that is hard and one that is merely long.
 */
export function playGreedily(level: LevelDef): Playthrough {
  // Straight from the definition, so verifying a level does not generate
  // one to do it with.
  const game = new Game(level);

  let now = 1000;
  let plays = 0;
  let peakSlots = 0;
  let strandedPlays = 0;

  for (let guard = 0; guard < GUARD && game.status === 'playing'; guard++) {
    if (game.hasFreeSlot) {
      const offered = game.fronts
        .map((block, column) => ({ block, column }))
        .filter((c): c is { block: NonNullable<typeof c.block>; column: number } => c.block !== null);

      const reachable = offered
        .filter((c) => game.reachable(c.block.color) > 0)
        .sort((a, b) => b.block.count - a.block.count);

      /* Strand only as a last resort: while a slot is still eating,
         waiting is free and may uncover the color. */
      const choice = reachable[0] ?? (game.isEating ? undefined : offered[0]);

      if (choice) {
        if (reachable.length === 0) strandedPlays++;
        if (game.place(choice.column, now).kind === 'placed') {
          plays++;
          peakSlots = Math.max(peakSlots, game.slots.filter((s) => s.block !== null).length);
          continue;
        }
      }
    }

    // Nothing to play: let time move so the panel can drain.
    if (!game.isDraining) break;
    now += TILE_INTERVAL_MS;
    game.tick(now);
  }

  return {
    won: game.status === 'won',
    plays,
    peakSlots,
    strandedPlays,
    tilesLeft: game.tilesLeft,
  };
}
