# Color Pixel Peel

A mobile puzzle game for iOS and Android, in the same visual world as
**Color Match & Merge**. Built as a TypeScript canvas game with
[Vite](https://vite.dev), wrapped in native shells with
[Capacitor](https://capacitorjs.com) so both stores ship from one codebase.

## The game

Three parts:

1. **The picture** — pixel art built from colored tiles, mounted on a card.
2. **The panel** — a row of slots where a played block goes.
3. **The hand** — numbered color blocks dealt into columns below the panel.

Play a block and it takes that many tiles of its color off the picture. Clear
the whole picture and the level is done.

There are five hundred levels, and none of them are written by hand: 100
pictures paired with 5 difficulty settings, each pairing dealt and then proved
winnable before it ships. [Levels, and the curve](#levels-and-the-curve) is how
that works.

### Only the front of each column can be played

The hand is dealt into columns, and just the front block of each is playable —
the ones behind are drawn above it, smaller, so what is coming can be planned
for. Columns are therefore how much choice the player has at any moment,
which is the tightest constraint in the game. A block you need but cannot
reach yet is exactly the thing to make room for.

### What "accessible" means

A tile can only be taken when it can be reached from outside the artwork: it
touches background on some side, or sits on the picture's edge. So the way in
is always the edge, and opening it up reaches what is behind.

That is not a detail — it is most of the puzzle. Every one of these pictures
is drawn with a dark outline, and an outline **encloses its own fill**. On the
Heart the red is walled in completely, so a red block played first has
nowhere to go at all.

A block whose color has nothing showing still plays, but **waits in its slot**
for tiles to appear instead of taking any. Tie up every slot with blocks that
cannot move and there is no way on — so the slot count is how many mistimed
blocks a level lets you get away with. One removal can expose tiles another
slot was waiting on, so after every play the panel re-resolves until nothing
more moves: a single block can cascade.

### Nothing says which blocks will work

A block that has nothing to take looks exactly like one that does. Working
that out from the picture **is** the game, so the buttons do not mark the
answer and neither do their labels — a screen reader is not told what a
sighted player has to judge. Guessing wrong is a move you are allowed to
make, and the panel is where you live with it.

An earlier version marked it up on the picture instead — every reachable tile
raised with an ink outline and a hard shadow. That worked on a board of five
big blocks and destroyed this: a picture stops reading as a picture the moment
each tile is drawn as a separate object. The artwork is flat fills on a cool
grey mount, and the mount is grey rather than white because `white` is a
playable color and the dog's muzzle vanished against paper.

**Nothing is drawn where there is no tile.** There used to be a faint print of
each empty cell, on the theory that it made progress visible. What it actually
did was tile the whole card in pale grey squares — and `slate` is a playable
color, so the background read as tiles the player still had to clear. The
mount shows through instead, for cells that were never artwork and cells
already taken alike. Progress is legible anyway, because the picture visibly
loses pieces.

### Blocks count down, several at once

A block played into the panel does not take anything at once. It sits in its
slot showing its own number and counts down — 12, 11, 10 — one tile every
180ms, and when it reaches zero the slot frees.

It was 500ms a tile when a picture was 40 to 188 tiles. The artwork is four
times finer now and blocks grew with it, so half a second each would leave a
block of twenty counting for ten seconds and the Owl taking six minutes of
animation to clear. At 180ms a typical block drains in three or four seconds,
which is what half a second a tile used to feel like — the number still
visibly counts down, it just runs.

**Every slot runs its own clock**, so blocks drain side by side. Play a dark
block and a green one and both eat the picture at the same time. The panel is a set of countdowns running together rather
than a queue waiting its turn, and nothing is locked while they run: any free
slot will take another block.

The number on the block **is** the countdown. An earlier version showed the
block's original value with a small badge counting down beside it, which put
the number that mattered in the smaller of the two.

A block whose color has nothing reachable simply waits, its number unmoved,
and starts counting the moment something opens that color up. Since every
picture's outline encloses its own fill, that is the normal opening: on the
Cat only dark can reach anything at all, and green, white and magenta each
sit there until the outline comes off.

This is a rule rather than a flourish, so the interval lives in `game.ts` and
the rules take the time as an argument instead of reading a clock — which is
what lets the tests drive a whole level frame by frame.

### The deal is shuffled

The hand is shuffled from the level's seed before it is dealt, and several
shuffles are tried with the least clumped kept. Dealt in written order, runs
of one color landed in one column — and a column of nothing but dark does
nothing whenever dark is buried.

Three things count against a deal: the same color twice in a row down a
column, a column holding only one color, and the same color repeated across a
row. That last one was learned from a deal whose three front blocks were all
red, on a picture whose red is walled in by its own outline — so the opening
move could not take anything at all, and three slots had to be spent finding
that out. A repeat in the front row costs four times what one further back
does.

It is all driven from the seed, so the deal is identical for every player and
the tests play the real one.

### The picture stays the same size while you play it

The board is sized once per level and does not move again. That needs the
hand's height to be fixed, which it is not by nature: as columns empty there
is less queued behind each front block, so the tray shrank from 158px to 57px
over a level and the picture grew into the space it left — the artwork
visibly changing size mid-play.

So `.column__queue` **reserves** the height of a full queue rather than sizing
to its contents, and the blocks sit at the bottom of that reserved box.
Measured across nine plays, the canvas now holds at exactly one height from
the first block to the last.

### Picking a picture

Home opens the picture list rather than dropping straight into a level, so a
cleared one can be played again. Everything up to the highest level reached is
open, the next one is picked out in gold, and the rest are shown but locked —
the list says how much game there is, not only how much of it you have seen.
The board's **← Menu** and the win card's **Menu** both return here.

Five hundred tiles is 18,000px of scroll, which is too much to hand over as
one run. Two things make it navigable. Each setting gets a full-width heading
carrying its name and how far through that run you are, so the list reads as
five hundreds rather than one five hundred. And opening it **scrolls the level
you are on into the middle** — at level 287 that tile is 10,000px down, and
starting at the top would mean scrolling past two and a half runs of cleared
levels to reach it.

The setting label came off the tiles when the headings went in: five hundred
tiles each repeating the same word is noise, and the tile already carries its
number and its picture. It stays in each tile's `aria-label`, where someone
arriving by screen reader has no heading in view to read it from.

### Levels, and the curve

The campaign is **generated, not authored**: 100 pictures × 5 settings = 500
levels. A setting says what size of block to aim for, how many blocks it will
allow, and how much room there is to hold one that cannot move yet.

| Setting | Aims for | At most | Slots | Columns | Panel peak |
|---------|----------|---------|-------|---------|------------|
| Gentle | blocks of 7 | 56 blocks | 5 | 3 | 5 |
| Easy | 8 | 52 | 5 | 4 | 5 |
| Normal | 9 | 50 | 4 | 4 | 4 |
| Hard | 10 | 46 | 3 | 4 | 3 |
| Expert | 11 | 42 | 2 | 5 | 2 |

**A size, with a ceiling on the count.** Both halves are needed. Aiming at a
block count does not survive a library this wide — fifty-six blocks is a
sensible cut of the 903-tile Owl and an absurd one of the 156-tile Heart,
where it comes out as fifty-six blocks of two. Aiming at a size alone does not
survive the slots, for the reason below.

Levels 1–100 are the whole library at Gentle, 101–200 the same pictures at
Easy, and so on — so the Heart is met four more times, each time with a
coarser cut and less panel to work with. The Owl, 903 tiles, is 50 blocks and
five slots at level 100 and **42 blocks and two slots** at level 500.

### The library is ordered by difficulty, not by size

That is a correction. The pictures used to be sorted smallest first, so the
903-tile Owl finished every run — and it was one of the easiest levels in the
game. **98% of its deals were winnable.** It was mostly one colour, and a
colour that abundant is always reachable, so its blocks never stranded and the
panel never came under pressure. Size is not difficulty.

What difficulty actually is, measured over 24 deals per picture at each of the
three tightest settings:

| Picture | Tiles | Colours | Deals winnable |
|---------|-------|---------|----------------|
| Owl (before) | 748 | 5 | 98% |
| Penguin | 434 | 3 | 100% |
| Cherry | 374 | 3 | 8% |
| Panda | 408 | 2 | 6% |
| Deer | 304 | 3 | 6% |

The Deer is the smallest picture in that list and the hardest thing in the
library. What makes it hard is a **small colour walled in deep** — a muzzle of
eight tiles behind everything else — because the block holding it ties up a
slot until the picture opens. That is the shape of a hard level, and it has
nothing to do with tile count.

So the order is now two rankings added together: how many deals are winnable,
and how many tiles there are. Either alone gets one end wrong — hardness alone
finishes the campaign on a two-colour Panda, size alone finishes it on
something trivial. Together a run opens on a small forgiving picture and
closes on a big unforgiving one. `tools/rank-pictures.js` prints the order and
the library is written in it; adding a picture means re-ranking.

### The Owl was redrawn to earn the finale

Fixing the order alone would have moved the Owl to 86th. It was redrawn
instead, because the finale should be the showpiece: slate wings, a white
chest with dark speckles, an orange beak and feet, a green branch, and eyes of
**eight yellow tiles buried behind two other colours** — the Deer's trick,
applied on purpose.

| | Tiles | Colours | Biggest colour | Deals winnable |
|--|-------|---------|----------------|----------------|
| Before | 748 | 5 | 57% | 98% |
| After | 903 | 7 | 36% | 38% |

A third of deals winnable is the target the brief asked for: you can lose it,
and losing it is about how you played rather than about which hand you got.

The settings sweep on the outside and the pictures on the inside on purpose.
Within a run of 100 the picture is the variable and the pressure is constant,
which is how a setting gets learned; a picture then returns a hundred levels
later, far enough apart to have been half forgotten, and harder when it does.

Difficulty is turned with four things and deliberately not with luck: the size
and tangle of the picture, how many colors it holds, how many **slots** there
are to park a block that cannot move yet, and how many columns the hand is
dealt into.

**Slots are the sharp one.** Every picture is drawn with an outline, and an
outline encloses its own fill — so most colors start unreachable, and a block
spent on one sits in a slot doing nothing until the outline comes off. Five
slots forgives that freely. Two do not: at Expert, spending one block on a
sealed color is half the panel gone.

**The panel is the ramp, and the cut follows it.** That is the opposite of
what this README used to say, and the measurements forced it: how many blocks
a setting can carry is capped by how many slots it gives, and the cap falls
steeply. So blocks cannot get finer as slots tighten — they get coarser, and
that turns out to be a difficulty story in its own right. Fewer slots and
bigger blocks both commit you for longer, so the two levers push the same way
instead of fighting.

### The hard end is where the deals stop working

The ceilings are swept, not chosen. Every candidate was dealt against all 100
pictures and played through before it was written down, because past a certain
point the deals simply stop being winnable at all:

| Slots | 100 of 100 winnable at | Starts failing at |
|-------|------------------------|-------------------|
| 5 | 58 blocks | 70 → 96 of 100 |
| 4 | 50 | 56 → 98 |
| 3 | 44 | 48 → 98 |
| 2 | 44 | 48 → 98, 64 → 92 |

Two slots and sixty-four blocks leaves eight pictures with no winnable deal
at all, however often it reseeds — so 64 is not a hard setting, it is a broken
one. Loosening the solver was tried first and does not help: a chooser that
prefers blocks the picture can pay in full, so slots free sooner, moved 92 to
93.

The ceiling is what stops the numbers on the tray getting smaller than they
are. The Owl at Expert wants blocks of eleven and gets blocks of twenty-one,
because forty-two is all two slots will carry. That is the honest limit of a
903-tile picture, not something a setting can tune away — and it is the one
place the finer artwork costs something.

The ceiling has to be exact, and for a while it was not. Each colour's share
of the blocks was rounded on its own, so the parts could sum past the total:
the seven-colour Owl came out at 51 blocks against a ceiling of 50. Largest
remainder fixes it — every colour gets at least one block and never more
blocks than it has tiles, and the remainder is shared out until the ceiling is
met exactly. A ceiling that leaks is not a ceiling, and this one is what keeps
the deals winnable.

### Adding a picture adds five levels

`src/core/pictures.ts` is the only place artwork lives — 100 pictures, from a
156-tile Heart to a 903-tile Owl. A picture is rows of
legend characters and a legend mapping them to palette colors, and nothing
else about it is written by hand — the blocks, the deal and the difficulty all
come from the setting it is paired with.

So the library grows five levels at a time. Adding one to `PICTURES` appends a
level to each setting's run; `LEVEL_COUNT` follows on its own.

The library was first drawn at nine to fifteen tiles across and then doubled,
so the pictures are now eighteen to thirty. Doubling is not a zoom: Scale2x
fills in the diagonal between two matching neighbours instead of leaving a
staircase, so a shape keeps its silhouette and stops being blocky at four
times the tile count. That matters because the tiles are what the player takes
off — a finer picture is a finer puzzle, not just a smoother one.

The drawing rules below are from the original pass, and still hold for
anything added by hand. At nine to fifteen tiles across
**flat shapes read and lattices do not**. A first pass drew a bee as wings and
a thin striped body with dark pixels threaded through it, and at that size it
came out as noise; the same bee as a solid seven-wide body with three stripes
and two wing blobs reads immediately. Anything that needed interior detail to
be recognisable — a snail's spiral, a squirrel's tail, a dolphin's snout — was
redrawn as a silhouette with one clear protrusion, or swapped for a subject
that survives the resolution.

### Every level is dealt, played and only then shipped

`generateLevel` cuts each color's tile count into blocks inside the setting's
size range, deals them into columns, and then **plays the result** with the
greedy solver in `solve.ts`. A deal that cannot be finished is thrown away and
the seed advanced, up to 40 times. Nothing reaches the picture list unproven.

That is the same bargain Color Match & Merge makes — a puzzle is kept only if
the solver can finish it — and it is what makes generation safe here at all.
With exact sums, an unwinnable deal is not merely hard, it is a level that
cannot be completed however well it is played.

`tools/check-levels.js` deals the whole campaign and prints what it measured,
which is where the table above comes from:

```
500 levels dealt, 500 winnable, 0 not
500/500 levels drive the panel to full
```

Every level now runs the panel out at some point, the openers included — at 20
blocks even the Heart fills five slots before it is done.

Two things had to be right for that to be true, and neither was:

- **The solver stranded too eagerly.** Told there was nothing reachable, it
  committed a slot to a sealed color rather than waiting for the panel to
  drain — which a player would never do, because waiting is free and may
  uncover that very color. Fixing it turned the Deer at Hard from unwinnable
  into winnable. "Something to wait for" then had to mean a slot that is
  actually *eating*, not one that merely still owes tiles: a slot holding a
  sealed color owes tiles it will never be paid, and the first version of the
  fix waited on it forever.
- **A setting is a target, not a promise.** The Deer at Expert is three
  colors, one of them a muzzle of eight tiles walled in behind the rest, and
  at two slots holding that one block is half the panel. Cut into 44 blocks
  almost every deal of it jams. Rather than reseed forever, or drag the whole
  Expert run down to what its worst picture can take, the generator eases the
  cut for that picture alone after 30 failed attempts. It is the only level of
  the five hundred that needs it, and what it buys is the guarantee.

Pass `--all` for the per-level table; without it only the aggregates print,
because five hundred rows is more than anyone reads at once.

### Levels are balanced, and checked

A level's blocks add up to its picture's tile counts **exactly** — nothing
spare, nothing missing — so clearing the picture means spending every block,
and a block wasted early is a level that can no longer be finished.

`levels.test.ts` checks that per color for all 500 levels, checks no two colors
in one picture sit closer than the distance rule allows, checks the settings
never soften as the campaign goes on, and plays every level through
**respecting the column constraint** — only ever choosing between the fronts —
to prove it can actually be won. The full suite is 884 tests. It takes about
35 seconds now rather than three — dealing and solving 500 levels of four
times the tiles is most of that — which is why `vite.config.ts` raises
Vitest's five-second default. Raised rather than sampled: proving every level
winnable is the point of it.

One rule there is weaker than it looks, and deliberately. The deal is not
allowed to stack a color, but "no column is ever one color" is not something
it can promise: a two-color picture cut into eight blocks and dealt into four
columns must sometimes put a pair together, and four levels out of five
hundred do. What the test pins is the thing the rule exists for — never three
of a color in a row, never every column at once, and never on a picture that
had a third color to deal instead.

## The screens

Home and the board are two screens in one document. There is **one mode**, so
home is a masthead, a single way in, and the footer pair — not Color Match's
grid of four. `Play` picks up at the highest level reached rather than
replaying level 1.

Color Match's mode icons say something true: its jar fills with how far
through the hundred levels you are. There are five hundred here, so the
picture list states it plainly — `n of 500 cleared`, and `n of 100` again on
each setting's heading — rather than drawing a meter. The icon shows the
mechanic instead, and the real numbers (level reached, best score) go in the
subtitle.

**Settings** is reachable from home and from the board, so Color Blind Assist
can be turned on without leaving a level. It holds what Color Match's does,
minus sound, which this game does not have yet.

### Erasing progress

Wiping progress asks, and then asks for six seconds of intent: a dialog
naming exactly what goes — the level reached and the best score — and then a
button that has to be held while a bar fills. Letting go early stops the bar
dead and nothing is lost.

The bar is driven frame by frame from script rather than by a CSS transition,
so releasing stops it exactly where it stood instead of animating on to
somewhere it never reached. That timing lives in `ui/hold.ts`, free of the DOM
and of `requestAnimationFrame` so the rules are testable: that an early
release loses nothing, that the action fires exactly once and only after the
full duration, and that keyboard auto-repeat is not holding. Holding works by
pointer or by keyboard, and the pointer is captured so a finger sliding off
the button still counts.

The assist preference **survives** the erase. It lives under its own key for
exactly this reason: a preference is not something earned, and wiping progress
should not silently change how the board is drawn.

## Shared with Color Match & Merge

This is meant to read as coming from the same place, so the parts that carry
that identity are taken from that repo rather than reinvented:

| | Shared |
|--|--------|
| `public/fonts.css` | The inlined Nunito and Baloo 2 subsets, copied as-is. Committed there for the same reason it is committed here: regenerating it needs network access, and the game should build and run without any. |
| `public/assets/polite-carrot-*.svg` | The startup lockup's mark and name, so both games open on the same black screen. |
| `src/style.css` | The design tokens verbatim — sky gradient, paper and ink, `--lift` / `--stroke` / `--radius` — and the component recipes built on them: 3px ink outlines, hard unblurred drop shadows, buttons that press into the page. |
| `src/core/palette.ts` | The color hexes, their letter marks, and the luminance rule that picks dark or light ink for a mark. |

The palette needed extending: pixel art wants an outline color and something
earthy, and a palette built for jars of liquid has neither. `dark`, `tan` and
`slate` are added from the house tokens so they stay in-family.

That move made the ≥150 distance rule **per picture** rather than
palette-wide, because `red` and `tan` sit 142 apart and both are worth
keeping. This is how Color Match enforces it too — its generator applies the
rule at deal time so a clashing pair cannot land on one shelf, rather than
banning the colors outright.

Two conventions came with it:

- **Deliberately single-theme.** There are no `prefers-color-scheme` blocks: a
  game screen is a place, not a document. Every color is painted explicitly,
  including the ground, so the page holds whatever the host paints behind it.
- **US spelling in anything a player reads** — *color*, never *colour*.

### The clash it still avoids

`teal` (#0ec3c6) is left out of the palette. It sits 103 from this list's
cyan, which is the clash that game's README still records as open. Omitting it
means no picture here can use the pair at all.

## Look

The same committed visual world: a bright board under a summer sky, drawn with
cartoon weight. The weight earns its place rather than decorating — the pixel
colors are vivid and so is the ground, so without an ink outline around every
tile the two would sit at the same brightness and flatten into each other.

Depth is drawn the way a jar's bands are: the layers under a tile's top color
appear as thin ink-separated stripes along its bottom edge, inside the tile's
own outline. An earlier version had them peeking out from behind the tile
instead, which at a 5px offset behind a 3px outline read as rendering
artifacts rather than as a stack, and bled into the neighbouring cell. A
cleared cell leaves a cool empty socket, so it reads as glass rather than as
nothing.

## The repository root *is* the site

Open `index.html` in a browser and the game runs. Nothing needs building
first, and GitHub Pages needs no configuration beyond serving this branch's
root — the same arrangement as Color Match & Merge.

Getting there costs one thing, and it is worth naming: **`app/` is committed
build output.** Pages serving a branch root can only hand a browser what is
actually in the branch, and a browser cannot run `src/` as it stands. So Vite
bundles `src/` into `app/app.js` and `app/app.css` with fixed names and no
sourcemap, and those two files are checked in beside the hand-written
`index.html`.

Cache-busting comes with it. Fixed filenames mean the URL never changes, so
a browser holding the old `app.js` goes on serving it — which is exactly what
happened once: Pages had published the new build and phones were still
running the previous one. `npm run build` therefore ends by stamping the
bundle's content hash into the two URLs `index.html` asks for
(`./app/app.js?v=…`). The path in git stays stable so diffs stay readable,
and the URL changes whenever the bytes do. `stamp.js` rewrites nothing else
in the page.

The hazard that creates is obvious: change `src/`, forget to rebuild, and the
site quietly serves a stale bundle. `.github/workflows/ci.yml` rebuilds on
every push and fails if `app/` **or `index.html`** does not match, so it
cannot reach `main` unnoticed. **After changing anything in `src/`, run
`npm run build` and commit `app/` and `index.html`.**

`index.html` is written by hand and the build touches only the `?v=` on those
two URLs. Every reference in it is relative, which is why the same files work
at a domain root and at `polite-carrot.github.io/Color-Pixel-Peel/` without a
`base` setting to get wrong.

### Where things live

```
index.html            the page, hand-written — the entry for everything
stamp.js              puts the bundle's hash in the URLs index.html asks for
fonts.css             committed: Nunito + Baloo 2, inlined
favicon.svg
assets/               the Polite Carrot lockup
app/                  committed build output: app.js, app.css
src/                  the source Vite bundles into app/
src/core/pictures.ts  the artwork library — 100 pictures, hardest last
tools/check-levels.js deals the whole campaign and reports what it measured
tools/rank-pictures.js orders the library by how often its deals are winnable
www/                  ignored — assembled by sync-web.js for the native shells
```

### Working on it

```bash
npm install
npm run build      # typecheck + bundle src/ into app/
npm run dev        # rebuild app/ on every save
npm run serve      # serve the repo root, i.e. the real artifact
npm test           # 164 unit tests
npm run typecheck
```

`dev` and `serve` are two terminals: one rebuilding, one serving. There is no
module-transforming dev server, because the page loads the same built bundle a
visitor gets — so what you are looking at locally is the artifact, not a
development-only variant of it.

## Build switches

`src/config.ts` is the one place a test build differs from a shipped one,
so turning this back into a real build is reading that file rather than
searching for what was loosened.

| Switch | Now | Before shipping |
|--------|-----|-----------------|
| `UNLOCK_ALL_LEVELS` | `true` | **`false`** |

With it on, every level in the list can be pressed whatever progress says,
so any of the five hundred is one tap away. It decides one thing — whether
a tile is disabled. **Progress is untouched:** the cleared ticks, the count
on each setting's heading, the gold next-to-play tile and the level the
list scrolls to all still come from how far you have actually got, so
turning it off is a straight revert rather than a repair.

Levels opened by the switch rather than earned are drawn in the locked
tile's pale paper, without the padlock, so the list still reads as
progress. And the screen says the build is a test build, in a line the
switch creates and takes away with it rather than markup left behind in
`index.html`.

Checked both ways at 390×844 against a save at level 120: on, 500 tiles
with none disabled, 380 marked as ahead and the gold tile still on 120;
off, 380 disabled, no banner, the same `119 of 500 cleared`.

## Shipping to iOS and Android

The native projects are generated by Capacitor and are **not** in this repo
yet — `cap add` needs the platform toolchains, so run these on a machine that
has them (iOS requires macOS with Xcode; Android requires Android Studio):

```bash
npm run build
npx cap add ios          # macOS + Xcode only
npx cap add android      # requires Android Studio / SDK

npm run ios              # build + sync + open Xcode
npm run android          # build + sync + open Android Studio
```

`npm run sync` (`build` + `sync-web.js` + `cap sync`) is the command to re-run
after any web change. Capacitor copies a single folder, and the game lives at
the repository root next to `node_modules`, so `sync-web.js` assembles a clean
`www/` from just the files `index.html` loads — taking that list from the
page's own `<script>` and `<link>` tags rather than keeping a second copy, so
a new module cannot silently miss the native build. The startup lockup's two
SVGs are named in it explicitly, since they are referenced from markup rather
than from a tag it scans. Commit the generated `ios/` and `android/` directories once they
exist, as Capacitor intends — they carry the icons, splash screens and signing
configuration. `.gitignore` already excludes their build output and fetched
dependencies.

App identity lives in `capacitor.config.ts`: `appId`
**`com.politecarrot.colorpixelpeel`**, which stays as it is — the identifier is
how a store recognises an app as an update to one already installed, so
changing it would strand every existing install rather than update it. The
native background is **black** rather than sky, to match the startup lockup the page opens on, so the native launch
and the lockup are one continuous screen instead of a flash of sky between
them.

Still to do before a store submission: app icons and splash screens
(`@capacitor/assets` generates both from one source image), store listing
metadata, and a signing profile for each platform.

## Layout

```
src/
  core/            # pure game logic, no DOM — this is what the tests cover
    rng.ts         # seeded mulberry32, so levels are reproducible
    palette.ts     # the shared palette, letter marks, and the 150 rule
    picture.ts     # ASCII rows + a legend → a grid of tiles
    pictures.ts    # the artwork library: 100 pictures, as data
    board.ts       # the grid, what "accessible" means, taking a color
    blocks.ts      # cutting blocks into columns, and the clump score
    generator.ts   # the five settings; deals a level and proves it winnable
    solve.ts       # the greedy solver the generator checks its work with
    levels.ts      # 100 pictures × 5 settings → the 500-level campaign
    game.ts        # score, moves, undo, win/lose, the draining panel
    storage.ts     # progress, and whether it can be trusted
  render/renderer.ts   # DPR-aware canvas drawing + the countdown animation
  input/pointer.ts     # pointer/touch → the tapped block
  ui/screens.ts        # home, the picture list, and the board
  ui/hud.ts            # topbar, toolbar and the win/loss card
  ui/settings.ts       # the settings dialog and the erase flow
  ui/hold.ts           # press-and-hold timing, no DOM — tested
  ui/modal.ts          # dialog open/close, focus and Escape
  native.ts            # Capacitor status bar + haptics, all optional
  main.ts              # wiring
```

`fonts.css` and `assets/` sit at the root rather than in a `public/` folder,
because the root is what gets served — there is no build step to copy them
into place.

The core is deliberately DOM-free so the rules can be tested headlessly, and
the renderer never mutates game state.

## Keeping progress

Progress and the assist preference live in the browser's own storage, because
progress belongs to the person playing rather than to everyone who opens the
page.

That storage is not guaranteed. A private window, an embedded view, or a
browser set to block site data can refuse it — sometimes by throwing, and
sometimes, worse, by accepting a write and keeping nothing. So `storage.ts`
picks its backing store by testing it: write a probe, read it back, and only
trust it if the value survives the round trip. Failing that it drops to session
storage, then to memory, and the game says plainly which of the three is in use
rather than letting someone earn a score that quietly vanishes.

The assist preference is kept under its own key, well away from the record of
progress: a preference is not something earned, and writing it must never put
anything near progress.

## It is an app, not a web page

This ships to the App Store and Play, where anything that behaves like a web
page reads as a bug. Four are switched off deliberately:

- **Text selection and the long-press callout**, set on every element rather
  than on `body` alone, because both inherit from whatever was actually
  touched. Selecting the briefing or getting a "copy / share" sheet on a tile
  has nothing to offer.
- **Double-tap zoom**, via `touch-action: manipulation`, which also removes the
  300ms wait before a tap registers.
- **Pinch zoom**, refused in JS. The viewport meta asks for no zoom, but iOS
  Safari has ignored `user-scalable=no` since iOS 10, so `gesturestart` —
  WebKit's own pinch event — is what actually stops it, with a two-finger
  `touchmove` guard behind it.
- **Image dragging**, so the startup lockup cannot be pulled around.

Nothing scrolls. The layout is sized to the visual viewport and the picture
gives up height to whatever else needs it, so the hand and the toolbar are
always reachable — checked at 375×667 and 390×844 on every level, including
the largest, where the tiles come out 240px tall's worth of board and simply
render smaller.

## Mobile and accessibility details

- **Safe areas**: the layout pads with `env(safe-area-inset-*)` under
  `viewport-fit=cover`, so nothing hides behind a notch or home indicator.
- **Sized to the visual viewport, not `dvh`.** On iOS Safari the toolbars are
  drawn *over* the page and `dvh` resolves to the viewport with them retracted
  — the tallest it could be — so a board sized to `dvh` runs underneath the
  toolbar. `main.ts` publishes `visualViewport.height` as `--vvh` and the
  layout prefers it, with `dvh` as the fallback.
- **Touch targets**: every control is at least 46px tall; taps are rejected if
  the finger drags beyond 14px or lands in the gap between tiles, so a misfire
  never peels the wrong region.
- **Color vision**: `Assist` draws each color's letter on its tiles, so the
  board never depends on hue alone. Dark or light ink is chosen per color by
  luminance. The preference persists.
- **Pinch-zoom is off**, which is a real accessibility cost — magnifying the
  page is exactly how some people read it. It is only defensible because the
  board already scales itself to the window and the text has no fixed pixel
  ceiling. Anyone changing it should weigh those two facts, not just the
  gesture.
- **Text scale is pinned** with `text-size-adjust: 100%`. The chrome is sized
  by its contents, so the system font-size setting would break this layout
  rather than grow it.
- **Battery**: the render loop only runs while something is animating; a static
  board costs nothing.
- **Reduced motion**: `prefers-reduced-motion` collapses animation, and the
  startup lockup fades in 100ms instead of 1350ms.

## Known gaps

- `npm audit` reports a moderate advisory in `uuid`, reached via
  `xcode` ← `@capacitor/cli`. It is a dev-only dependency used to generate the
  Xcode project and is not part of the shipped app; the only available fix is a
  breaking CLI downgrade.
- **One level, one picture.** The dog is 16×13 and coarse; the reference's
  artwork is far finer and there are many more of them.
- **No power-ups.** The reference has four along the bottom — an extra slot, a
  grab, and two others — and none exist here.
- **No score target.** The reference shows badges on the picture (a `30` and a
  `1000`) which look like goals or rewards; what they mean is still a guess, so
  nothing implements them.
- When more tiles of a color are reachable than a block asks for, it takes the
  ones nearest the top-left. That is consistent and predictable but arbitrary —
  if the player should be choosing, this is the rule to change.
- A hundred pictures, and each is still met five times. The library is the
  ceiling on variety the way the settings are the ceiling on length, and
  drawing is the slow part — so more artwork is the only thing that makes the
  campaign wider rather than longer.
- Bigger pictures mean bigger numbers, and there is no way round it. The Owl
  is 903 tiles held at 42 blocks by the two-slot ceiling, so its blocks run to
  the twenties while the Heart's are fives and sixes. Getting single figures
  on the Owl would need a hundred blocks, and 64 already leaves eight pictures
  with no winnable deal — so the number on a block is set by the artwork and
  the panel, not by taste.
- The library was doubled algorithmically rather than redrawn. Scale2x keeps
  every silhouette and smooths the diagonals, but it cannot add detail that
  was not drawn, so the outlines are two tiles thick and a few small features
  came out rounder than intended — the Owl's square eyes are now blobs. A
  hand-drawn pass at the new size would fix both.
- A picture is judged by eye, once. There is no test that says the Bear reads
  as a bear — only that its rows are even and its colors far enough apart. The
  contact sheet that catches the failures is a scratch tool, not part of the
  repo, so a redraw that quietly stops reading would pass CI.
- The difficulty order is a snapshot, not a rule the code enforces. It was
  measured once and written into the file, so a change to the settings, the
  solver or the cut can leave the library sorted by a ranking that is no
  longer true — and nothing will say so. Re-run `tools/rank-pictures.js` after
  touching any of them.
- Only the Owl was redrawn for variation. The measurements name others that
  are mostly one colour and correspondingly easy — the Penguin is 76% one
  colour and wins every deal — and they are still in the library as they were.
- The hardest levels are hard because a wrong block costs a slot, not because
  they demand precision. A player who could see which colors are reachable
  would find them straightforward; that information is deliberately withheld.
- The list shows cleared, next and locked, but no score per level. There is no
  par to measure a run against, so there is nothing honest to put there yet.
- The hand shows three blocks behind each front one and then a `+n`. A much
  longer column would need a different answer than a count.
- No sound. Color Match makes its blips with oscillators rather than audio
  files, which is the approach to copy when it is added.
- Below 420px the topbar's back button drops the word "Menu" and keeps the
  arrow. With it, the button and the stat chips squeezed the title column to
  62px, wrapping both the level name and the board shape onto second lines and
  taking the topbar from 77px to 126px — nearly 60px off the board on an
  iPhone SE. The button keeps its accessible name either way.
