# Pixel Peel

A picture drawn as a grid of coloured cubes, destroyed from the outside in.
Tap an exposed patch of one colour, spend a block of the right size, and the
patch goes — and what was behind it is now on the outside. Clear the whole grid
and the picture is finished.

Same family as [Color Match & Merge][merge]: same stack, same palette of
ink-outlined cartoon weight, same shelf-under-a-summer-sky world. The two are
meant to look like one studio made them on the same day.

[merge]: https://github.com/Polite-Carrot/color-sorting

**To play:** open `index.html` in a browser. No install, no build step, no
server.

## Where it has got to

This repository is being built in milestones, and it is not yet playable. What
is here now is milestone 2 — the rules, with nothing to look at.

| | |
|--|--|
| 1. Audit of the merge game, and what to share | done |
| 2. **Core logic and its tests, no UI** | **done** |
| 3. Playable game screen, placeholder styling | next |
| 4. Visual pass, audio, juice | |
| 5. Level format, PNG importer, solver, generator | |
| 6. Campaign, daily, infinite, level select, settings, persistence | |
| 7. Twenty launch levels, ad slot, polish | |

## Rules

- The board is a grid. Every cell holds a colour from the level's own palette,
  or nothing at all — a cell that was never there counts as already cleared.
- A cell is **exposed** if you could walk to it from off the edge of the grid,
  travelling four-directionally through cells that have gone. At the start that
  is the outer rim and nothing else.
- Tapping an exposed cell takes its **patch**: the same-coloured cells joined
  to it edge to edge, counting only cells that are themselves exposed. A buried
  cell of the same colour is not part of the patch, however close it looks.
- A patch of N cells costs a **block** of N. Three blocks sit in the hand and
  the rest queue up in sight, so a level is something to plan rather than
  something to be lucky at. Spending a block draws the next one in.
- Win by clearing every cell. Lose when nothing in the hand can take any
  exposed patch and there is no undo or shuffle left to buy a way out.

### Exact, or at least

`BLOCK_MATCH_MODE` in `js/peel.js` has two settings and ships on the first:

- `'exact'` — a block of N takes a patch of exactly N.
- `'at_least'` — a block of N takes any patch of N or fewer, and the surplus is
  thrown away. More forgiving, and much less of a puzzle.

Nothing reads the constant except the default: every function that cares takes
the mode as an argument, so the two can be put side by side in a test rather
than argued about.

### Assists

**Undo** takes back the last move, and **shuffle** puts the hand on the end of
the queue and draws a fresh one. Both are limited per level, and both are all
there is — no timers, no pay-to-win.

Two details in there are load-bearing:

- **A shuffle sends the old hand to the back of the queue rather than throwing
  it away.** The multiset of blocks is therefore unchanged, so a shuffle can
  reorder a level's difficulty but can never make a solvable level unsolvable
  by spending capacity the picture still needs.
- **Undo restores a snapshot wholesale rather than recomputing.** The block
  comes back to the slot it left, the queue comes back to the order it was in,
  and the cells come back to the picture they made. Recomputing is how an undo
  quietly diverges from what was there before. A shuffle is undoable on the
  same terms, which is why the spent shuffle comes back with it.

Stars are the assists you did not spend: three for finishing with none, two for
spending up to half the allowance, one for finishing at all.

## Exposure, and why it is one flood

`exposure()` is the whole peeling mechanic, and it is a single flood fill doing
two jobs at once. Walking onto an empty cell means the walk carries on through
it; walking onto a filled one means the walk stops there — but it got there, so
that cell is exposed. Filled cells are marked and never queued, which is
exactly what stops the flood leaking through the picture.

Two shapes fall out of that for free, and both are in the tests because both
are what a naive check gets wrong:

- **Concave shapes.** The mouth of a U is outside, so the floor of the U and
  the inside faces of both arms are all exposed.
- **Sealed pockets.** A hollow with no way out is never entered, so the ring of
  cells lining it stays buried — even though every one of them is touching an
  empty cell. "Next to something empty" is not the rule; "reachable from
  outside" is.

Corners do not count as a way through, either: two empty cells touching only at
a diagonal leave the pocket sealed.

## Layout

```
js/peel.js        the board, exposure, patches, the hand, undo   (no DOM)
js/color.js       hex, perceptual distance, ink and shade        (no DOM)
test/             the above, under node --test
```

Every module is an IIFE attaching one global, loaded by plain `<script src>`
in page order — the merge game's pattern, kept so a module can move between
the two repositories without being rewritten. Nothing in `js/` that holds a
rule is allowed to touch the DOM: it all has to run under Node for the tests,
the solver and the level builders.

## Checking

```
npm test
```

Fifty tests, no dependencies — `node --test` and `node:assert`, nothing else.
The merge game checks itself with hand-written scripts under `tools/` that
assert and exit non-zero; this is the same idea with the runner that ships in
Node.

Board fixtures are written as pictures, because a test that says what it means
is worth more here than a compact one. Every bug worth catching in this file is
a shape bug.

## Sharing with the merge game

The two games are separate repositories, so the shared parts are **copied, not
imported** — a published package or a submodule would mean changing the merge
game, and the rule for this build is that it is not touched. Each copied file
carries a header naming where it came from. If a real shared package is wanted
later, identical copies make that a move rather than a rewrite.

What comes over verbatim: the storage layer and its probe-it-first backend
choice, the daily schedule, the design tokens and every component style, the
fonts, the Polite Carrot startup lockup, the oscillator sound bank, the modals
including the six-second hold on Reset progress, and the Capacitor build
scripts. What is genuinely new: the board and its solver, the level format, the
PNG importer, and haptics.

## Where it deviates from the merge game

Three things, all deliberate, all recorded here so nobody has to guess:

- **There is a test runner.** The merge game has none. Pure rules with no tests
  is not a bargain worth keeping on a board whose whole mechanic is a flood
  fill.
- **There are haptics.** The merge game has none — not one call to `vibrate`
  or the Haptics plugin anywhere in it.
- **Ad unit IDs are Google's official test IDs.** Interstitials only, matching
  the merge game, which never calls the banner or rewarded formats. Swap in
  production IDs before a store build; `isTestAdId()` reads the publisher
  prefix and turns SDK test mode on or off from the ID alone, so either set
  works without another switch.

## Names

The game is **Pixel Peel**. The bundle identifier is
`com.politecarrot.pixelpeel` on both platforms. As in the merge game, anything
a player reads says *color*; the code may say either, though having no legacy
to carry it says *color* throughout.
