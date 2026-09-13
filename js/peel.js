/* peel.js — the board, and the rules for taking it apart.
 *
 * A level is a picture drawn as a grid of coloured cubes. The player destroys
 * it from the outside in: tap an exposed patch of one colour, spend a block of
 * the right size, and the patch goes. What was behind it is now on the outside,
 * and so it goes until nothing is left.
 *
 * Three ideas carry the whole game, and they are worth stating plainly because
 * every rule below is one of them:
 *
 *  - EXPOSURE. A cell is exposed if you could walk to it from off the edge of
 *    the grid, travelling only through cells that have already gone. So at the
 *    start only the outer rim is reachable; clearing a patch opens a way in.
 *    This is what makes the picture peel rather than dissolve.
 *  - REGION. Tapping an exposed cell takes the whole patch it belongs to — the
 *    same-coloured cells joined to it edge to edge, counting only cells that
 *    are themselves exposed. A buried cell of the same colour is not part of
 *    the patch, however close it looks.
 *  - CAPACITY. A patch of N cells costs a block of N. The hand holds three and
 *    the rest queue up in sight, so a level is something to plan rather than
 *    something to be lucky at.
 *
 * Pure logic, no DOM — this file runs under Node for the tests, the solver and
 * the level builders exactly as it runs in the browser. */
(function (global) {
  'use strict';

  /* A cell that has gone, and the character that means one in a level file. */
  var EMPTY = -1;
  var EMPTY_CHAR = '.';

  /* How a block's capacity has to answer a patch's size.
   *
   *   'exact'    — a block of N clears a patch of exactly N.
   *   'at_least' — a block of N clears any patch of N or fewer, and whatever
   *                is left over is thrown away.
   *
   * Exact is the game; at_least is the forgiving version of it, kept behind
   * this constant so the two can be put side by side rather than argued about.
   * Every function that cares takes the mode as an argument, so nothing reads
   * this except the default. */
  var MATCH_EXACT = 'exact';
  var MATCH_AT_LEAST = 'at_least';
  var BLOCK_MATCH_MODE = MATCH_EXACT;

  /* Three blocks in hand. Not a tuning knob so much as the shape of the game:
     one is a reflex test, five is a spreadsheet. */
  var HAND_SIZE = 3;

  /* ───────── reading a level ───────── */

  /* Cells are written row-major as one character per cell — a palette index,
     or '.' for a cell that was never there. Whitespace is ignored, so a level
     file may lay the picture out as a picture and stay human-editable. */
  function parseCells(text, width, height) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;
      if (ch === EMPTY_CHAR) { out.push(EMPTY); continue; }
      var n = parseInt(ch, 36);
      if (isNaN(n)) throw new Error('peel: level cells contain "' + ch + '", which is not a palette index or "' + EMPTY_CHAR + '"');
      out.push(n);
    }
    if (out.length !== width * height) {
      throw new Error('peel: level says ' + width + 'x' + height + ' (' + (width * height) + ' cells) but ' + out.length + ' were written');
    }
    return out;
  }

  /* The inverse, so a generator or an importer can write a level back out. */
  function writeCells(cells, width) {
    var rows = [];
    for (var y = 0; y * width < cells.length; y++) {
      var row = '';
      for (var x = 0; x < width; x++) {
        var v = cells[y * width + x];
        row += (v === EMPTY ? EMPTY_CHAR : v.toString(36));
      }
      rows.push(row);
    }
    return rows.join('\n');
  }

  /* ───────── exposure ───────── */

  /* Which cells could be reached from off the edge of the grid, travelling
     four-directionally through cells that have gone.
     
     One flood does both halves of the job. Walking onto an empty cell means
     the walk carries on through it; walking onto a filled one means the walk
     stops there — but it got there, so that cell is exposed. Filled cells are
     therefore marked and never queued, which is exactly what stops the flood
     leaking through the picture.
     
     Concave shapes fall out of this for free, and so do sealed pockets: a
     hollow with no way out is never entered, so the cells lining it stay
     unexposed until something opens a path. */
  function exposure(cells, width, height) {
    var n = width * height;
    var open = new Uint8Array(n);      /* empty, and joined to the outside */
    var exposed = new Uint8Array(n);   /* filled, and reachable from it */
    var stack = [];

    function visit(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      var i = y * width + x;
      if (cells[i] === EMPTY) {
        if (!open[i]) { open[i] = 1; stack.push(i); }
      } else {
        exposed[i] = 1;
      }
    }

    /* The outside touches every cell around the rim. */
    for (var x = 0; x < width; x++) { visit(x, 0); visit(x, height - 1); }
    for (var y = 0; y < height; y++) { visit(0, y); visit(width - 1, y); }

    while (stack.length) {
      var i = stack.pop();
      var cx = i % width, cy = (i / width) | 0;
      visit(cx - 1, cy); visit(cx + 1, cy);
      visit(cx, cy - 1); visit(cx, cy + 1);
    }

    return exposed;
  }

  /* ───────── regions ───────── */

  /* The patch containing a cell: same colour, joined edge to edge, and every
     cell of it exposed. Returned lowest index first so two calls on the same
     patch compare equal, which the solver leans on. */
  function regionAt(cells, width, height, exposed, index) {
    if (index < 0 || index >= cells.length) return null;
    if (!exposed[index] || cells[index] === EMPTY) return null;

    var colour = cells[index];
    var seen = {};
    var out = [];
    var stack = [index];
    seen[index] = true;

    while (stack.length) {
      var i = stack.pop();
      out.push(i);
      var cx = i % width, cy = (i / width) | 0;
      var around = [
        cx > 0 ? i - 1 : -1,
        cx < width - 1 ? i + 1 : -1,
        cy > 0 ? i - width : -1,
        cy < height - 1 ? i + width : -1
      ];
      for (var k = 0; k < 4; k++) {
        var j = around[k];
        if (j < 0 || seen[j]) continue;
        if (!exposed[j] || cells[j] !== colour) continue;
        seen[j] = true;
        stack.push(j);
      }
    }

    out.sort(function (a, b) { return a - b; });
    return out;
  }

  /* Every distinct exposed patch on the board, each listed once. */
  function regions(cells, width, height, exposed) {
    var claimed = {};
    var out = [];
    for (var i = 0; i < cells.length; i++) {
      if (!exposed[i] || cells[i] === EMPTY || claimed[i]) continue;
      var patch = regionAt(cells, width, height, exposed, i);
      for (var k = 0; k < patch.length; k++) claimed[patch[k]] = true;
      out.push({ colour: cells[i], cells: patch, size: patch.length });
    }
    return out;
  }

  /* ───────── legality ───────── */

  function fits(capacity, size, mode) {
    if (capacity == null) return false;
    return mode === MATCH_AT_LEAST ? capacity >= size : capacity === size;
  }

  /* ───────── a game in progress ───────── */

  function Game(level, opts) {
    opts = opts || {};
    this.level = level;
    this.width = level.width;
    this.height = level.height;
    this.palette = level.palette || [];
    this.matchMode = opts.matchMode || BLOCK_MATCH_MODE;
    this.handSize = opts.handSize || HAND_SIZE;
    this.restart();
  }

  Game.prototype.restart = function () {
    var lvl = this.level;
    this.cells = parseCells(lvl.cells, lvl.width, lvl.height);
    this.queue = (lvl.blocks || []).slice();
    this.hand = [];
    for (var i = 0; i < this.handSize; i++) {
      this.hand.push(this.queue.length ? this.queue.shift() : null);
    }
    this.undosLeft = lvl.undos || 0;
    this.shufflesLeft = lvl.shuffles || 0;
    this.moves = 0;
    this.history = [];
    this._exposed = null;
  };

  /* Cached, because every tap asks for it and a clear is the only thing that
     can change it. */
  Game.prototype.exposed = function () {
    if (!this._exposed) this._exposed = exposure(this.cells, this.width, this.height);
    return this._exposed;
  };

  Game.prototype.regionAt = function (index) {
    return regionAt(this.cells, this.width, this.height, this.exposed(), index);
  };

  Game.prototype.regions = function () {
    return regions(this.cells, this.width, this.height, this.exposed());
  };

  Game.prototype.indexOf = function (x, y) { return y * this.width + x; };

  /* Everything the player could legally do right now, as {handIndex, cells}.
     The stuck check and the solver both read this, so it is the single place
     that decides what "a move" is. */
  Game.prototype.legalMoves = function () {
    var patches = this.regions();
    var out = [];
    for (var h = 0; h < this.hand.length; h++) {
      for (var r = 0; r < patches.length; r++) {
        if (fits(this.hand[h], patches[r].size, this.matchMode)) {
          out.push({ handIndex: h, cells: patches[r].cells, size: patches[r].size, colour: patches[r].colour });
        }
      }
    }
    return out;
  };

  /* Exact state, kept so undo can put it back rather than recompute it.
     Recomputing is how an undo quietly diverges from what was there before. */
  Game.prototype._snapshot = function () {
    this.history.push({
      cells: this.cells.slice(),
      queue: this.queue.slice(),
      hand: this.hand.slice(),
      moves: this.moves,
      shufflesLeft: this.shufflesLeft
    });
  };

  /* Spend hand[handIndex] on the patch containing `index`.
   *
   * Refusals come back as a reason rather than a throw, because every one of
   * them is a thing a player does by accident and the screen answers with a
   * shake — not something that should end up in a console. */
  Game.prototype.clear = function (index, handIndex) {
    var block = this.hand[handIndex];
    if (block == null) return { ok: false, reason: 'empty-slot' };

    var patch = this.regionAt(index);
    if (!patch) return { ok: false, reason: 'not-exposed' };
    if (!fits(block, patch.length, this.matchMode)) {
      return { ok: false, reason: 'wrong-size', size: patch.length, block: block };
    }

    var colour = this.cells[patch[0]];
    this._snapshot();
    for (var i = 0; i < patch.length; i++) this.cells[patch[i]] = EMPTY;
    /* A block is replaced from the front of the queue the moment it is spent,
       so the hand is only short once the queue has genuinely run out. */
    this.hand[handIndex] = this.queue.length ? this.queue.shift() : null;
    this.moves++;
    this._exposed = null;

    return {
      ok: true,
      cleared: patch,
      colour: colour,
      block: block,
      drew: this.hand[handIndex],
      wasted: this.matchMode === MATCH_AT_LEAST ? block - patch.length : 0
    };
  };

  /* Put the hand back on the end of the queue and draw a fresh one.
   *
   * Back of the queue rather than thrown away, and that is the whole of why
   * this is safe to offer: the multiset of blocks is unchanged, so a shuffle
   * can reorder a level's difficulty but can never make a solvable level
   * unsolvable by spending capacity the picture still needs. */
  Game.prototype.shuffle = function () {
    if (this.shufflesLeft <= 0) return { ok: false, reason: 'none-left' };
    if (!this.queue.length) return { ok: false, reason: 'queue-empty' };

    this._snapshot();
    var held = this.hand.filter(function (b) { return b != null; });
    this.queue = this.queue.concat(held);
    this.hand = [];
    for (var i = 0; i < this.handSize; i++) {
      this.hand.push(this.queue.length ? this.queue.shift() : null);
    }
    this.shufflesLeft--;
    return { ok: true, hand: this.hand.slice() };
  };

  /* Step back one action — a clear or a shuffle, whichever was last.
   *
   * It restores the snapshot wholesale, so the block comes back to the hand it
   * came from, the queue comes back to the order it was in, and the cells come
   * back to the picture they made. Nothing is recomputed. */
  Game.prototype.undo = function () {
    if (!this.history.length) return { ok: false, reason: 'nothing-to-undo' };
    if (this.undosLeft <= 0) return { ok: false, reason: 'none-left' };

    var was = this.history.pop();
    this.cells = was.cells;
    this.queue = was.queue;
    this.hand = was.hand;
    this.moves = was.moves;
    this.shufflesLeft = was.shufflesLeft;
    this.undosLeft--;
    this._exposed = null;
    return { ok: true };
  };

  Game.prototype.won = function () {
    for (var i = 0; i < this.cells.length; i++) if (this.cells[i] !== EMPTY) return false;
    return true;
  };

  /* Stuck means there is nothing legal to do and nothing left to buy a way out
     with. An undo is only a way out if there is something to undo, and a
     shuffle only if there is a queue to draw from — otherwise the button is
     there but does nothing, which is not the same as having a move. */
  Game.prototype.stuck = function () {
    if (this.won()) return false;
    if (this.legalMoves().length) return false;
    if (this.undosLeft > 0 && this.history.length) return false;
    if (this.shufflesLeft > 0 && this.queue.length) return false;
    return true;
  };

  /* Three stars for finishing the picture without help, and one for finishing
     it at all. Assists are the only currency here — there is no timer and no
     move limit, so spending nothing is the thing worth measuring. */
  Game.prototype.stars = function () {
    if (!this.won()) return 0;
    var allowance = (this.level.undos || 0) + (this.level.shuffles || 0);
    var spent = allowance - (this.undosLeft + this.shufflesLeft);
    if (spent === 0) return 3;
    if (spent <= Math.ceil(allowance / 2)) return 2;
    return 1;
  };

  global.Peel = {
    EMPTY: EMPTY,
    EMPTY_CHAR: EMPTY_CHAR,
    HAND_SIZE: HAND_SIZE,
    MATCH_EXACT: MATCH_EXACT,
    MATCH_AT_LEAST: MATCH_AT_LEAST,
    BLOCK_MATCH_MODE: BLOCK_MATCH_MODE,
    parseCells: parseCells,
    writeCells: writeCells,
    exposure: exposure,
    regionAt: regionAt,
    regions: regions,
    fits: fits,
    Game: Game
  };
})(typeof window !== 'undefined' ? window : globalThis);
