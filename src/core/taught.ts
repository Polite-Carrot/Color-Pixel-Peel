/**
 * Hand-authored levels.
 *
 * These come before the generated ladder because each one exists to teach
 * a rule, and that is not something a generator can be asked for — the
 * same reason Color Match writes its first five by hand. They are data
 * only; `level.ts` builds and verifies them, so nothing here can ship a
 * board whose solution does not play.
 *
 * `layers` is bottom layer first, so the file reads as a picture of the
 * board: a digit is a color id (see PALETTE), `.` means no layer there.
 * `solution` is one cell index per move, in order.
 */
export interface TaughtLevel {
  /** The one rule this level is here to teach, shown above the board. */
  brief: string;
  layers: readonly (readonly string[])[];
  solution: readonly number[];
  moveLimit: number;
}

export const TAUGHT: readonly TaughtLevel[] = [
  {
    /* Level 1 — peeling at all.
     *
     * Three colors, twelve cells, and a deliberate shape to the six
     * moves: the first three are the smallest run the game allows, and
     * clearing them tidies the board into three clean stripes that the
     * last three sweep away four at a time. So it teaches the minimum run
     * and that something waits underneath, and then pays that off.
     *
     *   Y Y R R      tops, with the second layer under the Y and R pairs
     *   R R B B
     *   Y Y R R
     */
    brief: 'Tap two or more of the same color that touch. They peel away — and the color underneath comes up.',
    layers: [
      ['0000', '1111', '2222'],
      ['22..', '00..', '..00'],
    ],
    solution: [4, 10, 0, 8, 4, 0],
    moveLimit: 9,
  },
];

export const TAUGHT_COUNT = TAUGHT.length;
