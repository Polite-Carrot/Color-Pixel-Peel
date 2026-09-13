/* Tests for the pure board logic.
 *
 * Boards are written as pictures, because a test that says what it means is
 * worth more here than a compact one — every one of these is a shape somebody
 * could draw, and the bugs worth catching are shape bugs. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

require('../js/peel.js');
const Peel = globalThis.Peel;
const EMPTY = Peel.EMPTY;

/* Build a board from rows of characters, so a fixture reads as the picture. */
function grid(rows) {
  const height = rows.length;
  const width = rows[0].length;
  rows.forEach((r, i) => assert.strictEqual(r.length, width, 'row ' + i + ' is a different width'));
  return { width, height, cells: Peel.parseCells(rows.join(''), width, height) };
}

function exposedSet(rows) {
  const g = grid(rows);
  const ex = Peel.exposure(g.cells, g.width, g.height);
  const out = [];
  for (let y = 0; y < g.height; y++) {
    let line = '';
    for (let x = 0; x < g.width; x++) {
      const i = y * g.width + x;
      line += g.cells[i] === EMPTY ? '.' : (ex[i] ? '#' : '-');
    }
    out.push(line);
  }
  return out;
}

function level(rows, blocks, extra) {
  const g = grid(rows);
  return Object.assign({
    id: 'test',
    name: 'Test',
    width: g.width,
    height: g.height,
    palette: ['#111111', '#e8544f', '#f2f2f0', '#3f7d55', '#2244cc'],
    cells: rows.join(''),
    blocks: blocks || [],
    undos: 0,
    shuffles: 0
  }, extra || {});
}

/* ───────── exposure ───────── */

test('exposure: a solid block exposes its rim and nothing inside', () => {
  assert.deepStrictEqual(exposedSet([
    '0000',
    '0000',
    '0000',
    '0000'
  ]), [
    '####',
    '#--#',
    '#--#',
    '####'
  ]);
});

test('exposure: a one-cell-wide board is entirely exposed', () => {
  assert.deepStrictEqual(exposedSet(['000', '000']), ['###', '###']);
});

test('exposure: cleared cells carry the outside inwards', () => {
  /* The gap in the top row is a corridor: everything it touches is reachable. */
  assert.deepStrictEqual(exposedSet([
    '0.00',
    '0000',
    '0000',
    '0000'
  ]), [
    '#.##',
    '##-#',
    '#--#',
    '####'
  ]);
});

test('exposure: a concave shape reaches into its own mouth', () => {
  /* A U. The two empty cells in the middle are open to the top, so the floor
     of the U and the inside faces of both arms are all exposed. */
  assert.deepStrictEqual(exposedSet([
    '0..0',
    '0..0',
    '0..0',
    '0000'
  ]), [
    '#..#',
    '#..#',
    '#..#',
    '####'
  ]);
});

test('exposure: a sealed pocket exposes nothing that lines it', () => {
  /* The hollow at the centre has no way out, so the ring around it stays
     unexposed even though it is touching empty cells. This is the case a
     naive "next to an empty cell" check gets wrong. */
  assert.deepStrictEqual(exposedSet([
    '000000',
    '000000',
    '00..00',
    '00..00',
    '000000',
    '000000'
  ]), [
    '######',
    '#----#',
    '#-..-#',
    '#-..-#',
    '#----#',
    '######'
  ]);
});

test('exposure: a pocket opened by one cleared cell floods', () => {
  /* The same board with a single cell removed from the rim outward. Now the
     pocket is connected to the outside and its lining is exposed. */
  assert.deepStrictEqual(exposedSet([
    '00.000',
    '00.000',
    '00..00',
    '00..00',
    '000000',
    '000000'
  ]), [
    '##.###',
    '##.#-#',
    '##..##',
    '##..##',
    '#-##-#',
    '######'
  ]);
});

test('exposure: diagonal gaps do not let the outside through', () => {
  /* The two empty cells touch only at a corner, so there is no
     four-directional path between them and the pocket stays sealed. */
  const rows = [
    '00000',
    '0.000',
    '00.00',
    '00000',
    '00000'
  ];
  const g = grid(rows);
  const ex = Peel.exposure(g.cells, g.width, g.height);
  /* The cell at (2,1) sits between the two gaps; it is not on the rim and the
     only empty cell touching it is the one at (1,1), which is itself sealed. */
  assert.strictEqual(ex[1 * 5 + 2], 0);
});

/* ───────── regions ───────── */

test('regionAt: takes the connected same-coloured exposed patch', () => {
  const g = grid([
    '1100',
    '1100',
    '0000',
    '0000'
  ]);
  const ex = Peel.exposure(g.cells, g.width, g.height);
  const patch = Peel.regionAt(g.cells, g.width, g.height, ex, 0);
  /* (1,1) is colour 1 but buried, so it is not part of the patch. */
  assert.deepStrictEqual(patch, [0, 1, 4]);
});

test('regionAt: does not join diagonally', () => {
  const g = grid([
    '10',
    '01'
  ]);
  const ex = Peel.exposure(g.cells, g.width, g.height);
  assert.deepStrictEqual(Peel.regionAt(g.cells, g.width, g.height, ex, 0), [0]);
});

test('regionAt: refuses a buried cell and an empty one', () => {
  const g = grid([
    '000',
    '010',
    '000'
  ]);
  const ex = Peel.exposure(g.cells, g.width, g.height);
  assert.strictEqual(Peel.regionAt(g.cells, g.width, g.height, ex, 4), null);

  const h = grid(['0.0']);
  const hex = Peel.exposure(h.cells, h.width, h.height);
  assert.strictEqual(Peel.regionAt(h.cells, h.width, h.height, hex, 1), null);
});

test('regions: lists every exposed patch once', () => {
  const g = grid([
    '1122',
    '1122'
  ]);
  const ex = Peel.exposure(g.cells, g.width, g.height);
  const found = Peel.regions(g.cells, g.width, g.height, ex);
  assert.strictEqual(found.length, 2);
  assert.deepStrictEqual(found.map(r => r.size), [4, 4]);
  assert.deepStrictEqual(found.map(r => r.colour), [1, 2]);
});

test('regions: one colour in two separate patches counts twice', () => {
  const g = grid(['1.1']);
  const ex = Peel.exposure(g.cells, g.width, g.height);
  const found = Peel.regions(g.cells, g.width, g.height, ex);
  assert.strictEqual(found.length, 2);
  assert.deepStrictEqual(found.map(r => r.size), [1, 1]);
});

/* ───────── matching ───────── */

test('fits: exact demands the same number', () => {
  assert.strictEqual(Peel.fits(4, 4, Peel.MATCH_EXACT), true);
  assert.strictEqual(Peel.fits(5, 4, Peel.MATCH_EXACT), false);
  assert.strictEqual(Peel.fits(3, 4, Peel.MATCH_EXACT), false);
});

test('fits: at_least allows a surplus but never a shortfall', () => {
  assert.strictEqual(Peel.fits(4, 4, Peel.MATCH_AT_LEAST), true);
  assert.strictEqual(Peel.fits(5, 4, Peel.MATCH_AT_LEAST), true);
  assert.strictEqual(Peel.fits(3, 4, Peel.MATCH_AT_LEAST), false);
});

test('fits: an empty hand slot never fits anything', () => {
  assert.strictEqual(Peel.fits(null, 1, Peel.MATCH_AT_LEAST), false);
  assert.strictEqual(Peel.fits(undefined, 0, Peel.MATCH_EXACT), false);
});

test('clear: exact mode refuses a block of the wrong size', () => {
  const g = new Peel.Game(level(['11', '11'], [3, 4, 4]));
  const wrong = g.clear(0, 0);              /* block 3 against a patch of 4 */
  assert.strictEqual(wrong.ok, false);
  assert.strictEqual(wrong.reason, 'wrong-size');
  assert.strictEqual(g.moves, 0);

  const right = g.clear(0, 1);              /* block 4 against a patch of 4 */
  assert.strictEqual(right.ok, true);
  assert.strictEqual(g.won(), true);
});

test('clear: at_least mode spends a bigger block and records the waste', () => {
  const g = new Peel.Game(level(['11', '11'], [7, 4]), { matchMode: Peel.MATCH_AT_LEAST });
  const res = g.clear(0, 0);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.wasted, 3);
  assert.strictEqual(g.won(), true);
});

/* ───────── playing ───────── */

test('clear: spending a block draws the next one from the queue', () => {
  const g = new Peel.Game(level(['12'], [1, 1, 1, 9]));
  assert.deepStrictEqual(g.hand, [1, 1, 1]);
  assert.deepStrictEqual(g.queue, [9]);

  const res = g.clear(0, 0);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.block, 1);
  assert.strictEqual(res.drew, 9);
  assert.deepStrictEqual(g.hand, [9, 1, 1]);
  assert.deepStrictEqual(g.queue, []);
});

test('clear: the hand goes short only once the queue is genuinely empty', () => {
  const g = new Peel.Game(level(['12'], [1, 1]));
  assert.deepStrictEqual(g.hand, [1, 1, null]);
  g.clear(0, 0);
  assert.deepStrictEqual(g.hand, [null, 1, null]);
});

test('clear: peeling the rim exposes what was behind it', () => {
  const g = new Peel.Game(level([
    '1111',
    '1221',
    '1221',
    '1111'
  ], [12, 4]));
  /* The 2s are sealed in, so there is nothing legal against them yet. */
  assert.strictEqual(g.regionAt(g.indexOf(1, 1)), null);

  const res = g.clear(0, 0);                /* the whole ring of 1s, 12 cells */
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.cleared.length, 12);

  const inner = g.regionAt(g.indexOf(1, 1));
  assert.deepStrictEqual(inner.length, 4);
  assert.strictEqual(g.hand[0], null, 'the 12 was spent and the queue was empty');
  assert.strictEqual(g.clear(g.indexOf(1, 1), 1).ok, true);
  assert.strictEqual(g.won(), true);
});

test('clear: tapping a buried cell is refused without costing anything', () => {
  const g = new Peel.Game(level([
    '111',
    '121',
    '111'
  ], [8, 1]));
  const res = g.clear(g.indexOf(1, 1), 0);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'not-exposed');
  assert.strictEqual(g.moves, 0);
  assert.deepStrictEqual(g.hand, [8, 1, null]);
  assert.strictEqual(g.history.length, 0);
});

/* ───────── undo ───────── */

test('undo: restores cells, hand, queue and move count exactly', () => {
  const g = new Peel.Game(level(['1122', '1122'], [4, 4, 5, 6]), {});
  g.undosLeft = 2;

  const before = {
    cells: g.cells.slice(),
    hand: g.hand.slice(),
    queue: g.queue.slice(),
    moves: g.moves
  };

  assert.strictEqual(g.clear(0, 0).ok, true);
  assert.notDeepStrictEqual(g.cells, before.cells);

  assert.strictEqual(g.undo().ok, true);
  assert.deepStrictEqual(g.cells, before.cells);
  assert.deepStrictEqual(g.hand, before.hand);
  assert.deepStrictEqual(g.queue, before.queue);
  assert.strictEqual(g.moves, before.moves);
  assert.strictEqual(g.undosLeft, 1);
});

test('undo: exposure is recomputed, not left stale', () => {
  const g = new Peel.Game(level([
    '1111',
    '1221',
    '1221',
    '1111'
  ], [12, 4]), { });
  g.undosLeft = 1;

  g.clear(0, 0);
  assert.notStrictEqual(g.regionAt(g.indexOf(1, 1)), null);
  g.undo();
  assert.strictEqual(g.regionAt(g.indexOf(1, 1)), null, 'the ring is back, so the middle is buried again');
});

test('undo: refuses when the allowance is spent, and when there is nothing to undo', () => {
  const g = new Peel.Game(level(['11'], [2, 2]));
  assert.deepStrictEqual(g.undo(), { ok: false, reason: 'nothing-to-undo' });
  g.clear(0, 0);
  assert.deepStrictEqual(g.undo(), { ok: false, reason: 'none-left' });
});

test('undo: several steps unwind in order', () => {
  const g = new Peel.Game(level(['1.2.3'], [1, 1, 1]));
  g.undosLeft = 3;
  const start = g.cells.slice();

  g.clear(0, 0);
  g.clear(2, 1);
  g.clear(4, 2);
  assert.strictEqual(g.won(), true);

  g.undo(); g.undo(); g.undo();
  assert.deepStrictEqual(g.cells, start);
  assert.strictEqual(g.moves, 0);
  assert.strictEqual(g.won(), false);
});

/* ───────── shuffle ───────── */

test('shuffle: draws a new hand and keeps every block', () => {
  const g = new Peel.Game(level(['1'], [1, 2, 3, 4, 5, 6]), {});
  g.shufflesLeft = 1;
  const all = g.hand.concat(g.queue).sort();

  const res = g.shuffle();
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(g.hand, [4, 5, 6]);
  assert.deepStrictEqual(g.queue, [1, 2, 3]);
  assert.deepStrictEqual(g.hand.concat(g.queue).sort(), all,
    'a shuffle must not spend capacity the picture still needs');
  assert.strictEqual(g.shufflesLeft, 0);
});

test('shuffle: refuses with none left, or with an empty queue', () => {
  const g = new Peel.Game(level(['1'], [1, 2, 3]));
  assert.deepStrictEqual(g.shuffle(), { ok: false, reason: 'none-left' });
  g.shufflesLeft = 1;
  assert.deepStrictEqual(g.shuffle(), { ok: false, reason: 'queue-empty' });
});

test('shuffle: is undoable like any other move', () => {
  const g = new Peel.Game(level(['1'], [1, 2, 3, 4]), {});
  g.shufflesLeft = 1;
  g.undosLeft = 1;
  const hand = g.hand.slice(), queue = g.queue.slice();

  g.shuffle();
  assert.notDeepStrictEqual(g.hand, hand);

  g.undo();
  assert.deepStrictEqual(g.hand, hand);
  assert.deepStrictEqual(g.queue, queue);
  assert.strictEqual(g.shufflesLeft, 1, 'the spent shuffle comes back too');
});

/* ───────── win and lose ───────── */

test('won: only when every cell has gone', () => {
  const g = new Peel.Game(level(['11.'], [2]));
  assert.strictEqual(g.won(), false);
  g.clear(0, 0);
  assert.strictEqual(g.won(), true);
});

test('won: a board of nothing but empty cells starts won', () => {
  assert.strictEqual(new Peel.Game(level(['..', '..'], [])).won(), true);
});

test('stuck: no legal move and no assists left', () => {
  /* One patch of two, and only a block of five to spend on it. */
  const g = new Peel.Game(level(['11'], [5]));
  assert.strictEqual(g.legalMoves().length, 0);
  assert.strictEqual(g.stuck(), true);
});

test('stuck: a winnable position is never stuck', () => {
  const g = new Peel.Game(level(['11'], [2]));
  assert.strictEqual(g.stuck(), false);
});

test('stuck: a won board is not stuck', () => {
  const g = new Peel.Game(level(['11'], [2]));
  g.clear(0, 0);
  assert.strictEqual(g.won(), true);
  assert.strictEqual(g.stuck(), false);
});

test('stuck: an undo is a way out only when there is something to undo', () => {
  const g = new Peel.Game(level(['11'], [5]), {});
  g.undosLeft = 3;
  assert.strictEqual(g.stuck(), true, 'undos left, but no move has been made');

  const h = new Peel.Game(level(['1.1'], [1, 5]), {});
  h.undosLeft = 1;
  h.clear(0, 0);
  assert.strictEqual(h.legalMoves().length, 0, 'a 5 against a patch of 1');
  assert.strictEqual(h.stuck(), false, 'the last move can be taken back');
});

test('stuck: a shuffle is a way out only when the queue can supply one', () => {
  const g = new Peel.Game(level(['11'], [5]), {});
  g.shufflesLeft = 2;
  assert.strictEqual(g.stuck(), true, 'shuffles left, but nothing to draw');

  const h = new Peel.Game(level(['11'], [5, 5, 5, 2]), {});
  h.shufflesLeft = 1;
  assert.strictEqual(h.legalMoves().length, 0);
  assert.strictEqual(h.stuck(), false, 'the 2 is still in the queue');
});

/* ───────── stars ───────── */

test('stars: three for finishing without help, none for not finishing', () => {
  const g = new Peel.Game(level(['11'], [2]), {});
  assert.strictEqual(g.stars(), 0);
  g.clear(0, 0);
  assert.strictEqual(g.stars(), 3);
});

test('stars: spending the allowance costs stars', () => {
  const lvl = level(['1.1.1.1'], [1, 1, 1, 1], { undos: 2, shuffles: 2 });

  const two = new Peel.Game(lvl, {});
  two.clear(0, 0); two.undo();
  two.clear(0, 0); two.clear(2, 1); two.clear(4, 2); two.clear(6, 0);
  assert.strictEqual(two.won(), true);
  assert.strictEqual(two.stars(), 2, 'one of four spent');

  const one = new Peel.Game(lvl, {});
  one.shuffle();
  one.clear(0, 0); one.undo();
  one.clear(0, 0); one.undo();
  one.clear(0, 0); one.clear(2, 1); one.clear(4, 2); one.clear(6, 0);
  assert.strictEqual(one.won(), true);
  assert.strictEqual(one.stars(), 1, 'three of four spent');
});

/* ───────── level files ───────── */

test('parseCells: reads a picture laid out as a picture', () => {
  const cells = Peel.parseCells('01\n2.', 2, 2);
  assert.deepStrictEqual(cells, [0, 1, 2, EMPTY]);
});

test('parseCells: refuses a board that is not the size it claims', () => {
  assert.throws(() => Peel.parseCells('012', 2, 2), /4 cells/);
});

test('parseCells: refuses a character that is not a palette index', () => {
  assert.throws(() => Peel.parseCells('0*', 2, 1), /not a palette index/);
});

test('writeCells: round-trips', () => {
  const rows = ['012.', '3.10', '2222'];
  const cells = Peel.parseCells(rows.join(''), 4, 3);
  assert.strictEqual(Peel.writeCells(cells, 4), rows.join('\n'));
});

/* ───────── restart ───────── */

test('restart: puts the level back exactly as it was dealt', () => {
  const g = new Peel.Game(level(['1122', '1122'], [4, 4, 7]), {});
  g.undosLeft = 1;
  const cells = g.cells.slice(), hand = g.hand.slice(), queue = g.queue.slice();

  g.clear(0, 0);
  g.restart();

  assert.deepStrictEqual(g.cells, cells);
  assert.deepStrictEqual(g.hand, hand);
  assert.deepStrictEqual(g.queue, queue);
  assert.strictEqual(g.moves, 0);
  assert.strictEqual(g.history.length, 0);
});
