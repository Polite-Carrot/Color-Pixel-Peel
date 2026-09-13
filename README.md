# Color Pixel Peel

A mobile puzzle game for iOS and Android, in the same visual world as
**Color Match & Merge**. Built as a TypeScript canvas game with
[Vite](https://vite.dev), wrapped in native shells with
[Capacitor](https://capacitorjs.com) so both stores ship from one codebase.

## The game

Three parts, matching the reference:

1. **The picture** — pixel art built from colored tiles, mounted on a card.
2. **The panel** — a row of slots above the blocks, where a played block goes.
3. **The blocks** — numbered color chips in a tray. A `12` on dark takes twelve
   dark tiles off the picture.

Play a block and it immediately takes as many tiles of its color as it can.
Clear the whole picture and the level is done.

### What "accessible" means

A tile can only be taken when it can be reached from outside the artwork: it
touches background on some side, or sits on the board's edge. So at the start
only the picture's outline is available, and opening it up is what reaches the
tiles behind. It is why the dog's muzzle, nose and ears cannot be taken first
— they are walled in by the head.

That is also what gives the panel a job. A block whose color has nothing
showing still plays, but it **waits in its slot** for tiles to appear instead
of taking any. Tie up every slot with blocks that cannot move and there is no
way on — so the slot count is how many mistimed blocks a level lets you get
away with.

One removal can expose tiles another slot was waiting on, so after every play
the panel re-resolves until nothing more moves. A single block can cascade.

### Reachability is shown in the tray, not on the picture

A block whose color has nothing available is drawn hatched and desaturated,
which is where the player looks to understand why nothing happened.

An earlier version marked it up on the picture instead — every reachable tile
raised with an ink outline and a hard shadow. That worked on a board of five
big blocks and destroyed this: a picture stops reading as a picture the moment
each tile is drawn as a separate object. The artwork is now flat fills on a
cool grey mount, and the mount is grey rather than white because `white` is a
playable color and the dog's muzzle vanished against paper.

### Levels are balanced, and checked

A level's blocks add up to its picture's tile counts **exactly** — nothing
spare, nothing missing — so clearing the picture means spending every block.
`levels.test.ts` checks that per color, checks no two colors in one picture sit
closer than the distance rule allows, checks at least one color starts buried
(or the panel would never teach anything), and plays each level through
greedily to prove it can actually be won.

## The screens

Home and the board are two screens in one document. There is **one mode**, so
home is a masthead, a single way in, and the footer pair — not Color Match's
grid of four. `Play` picks up at the highest level reached rather than
replaying level 1.

Color Match's mode icons say something true: its jar fills with how far
through the hundred levels you are. These levels are generated without end, so
there is no honest denominator to fill against — a meter there would be
decoration pretending to be information. The icon shows the mechanic instead,
a stack with its top layer lifting off, and the real numbers (level reached,
best score) go in the subtitle where they can be stated plainly.

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

The hazard that creates is obvious: change `src/`, forget to rebuild, and the
site quietly serves a stale bundle. `.github/workflows/ci.yml` rebuilds on
every push and fails if `app/` does not match, so it cannot reach `main`
unnoticed. **After changing anything in `src/`, run `npm run build` and commit
`app/`.**

Nothing generates or rewrites `index.html`. It is written by hand and every
reference in it is relative, which is why the same files work at a domain root
and at `polite-carrot.github.io/Color-Pixel-Peel/` without a `base` setting to
get wrong.

### Where things live

```
index.html            the page, hand-written — the entry for everything
fonts.css             committed: Nunito + Baloo 2, inlined
favicon.svg
assets/               the Polite Carrot lockup
app/                  committed build output: app.js, app.css
src/                  the source Vite bundles into app/
www/                  ignored — assembled by sync-web.js for the native shells
```

### Working on it

```bash
npm install
npm run build      # typecheck + bundle src/ into app/
npm run dev        # rebuild app/ on every save
npm run serve      # serve the repo root, i.e. the real artifact
npm test           # 60 unit tests
npm run typecheck
```

`dev` and `serve` are two terminals: one rebuilding, one serving. There is no
module-transforming dev server, because the page loads the same built bundle a
visitor gets — so what you are looking at locally is the artifact, not a
development-only variant of it.

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
    board.ts       # layer stacks, flood-fill regions, the peel operation
    authoring.ts   # ASCII layer grids → a board, for authored levels
    taught.ts      # the hand-authored levels, as data
    level.ts       # authored/dealt routing, generator + solution verifier
    game.ts        # score, moves, undo, win/lose, level progression
    storage.ts     # progress, and whether it can be trusted
  render/renderer.ts   # DPR-aware canvas drawing + the lift-away animation
  input/pointer.ts     # pointer/touch → cell, with drag-slop rejection
  ui/screens.ts        # home and board, and what home says about progress
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
- The tray scrolls past two rows of blocks. Fine for fourteen; a picture with
  forty blocks needs a different answer.
- No sound. Color Match makes its blips with oscillators rather than audio
  files, which is the approach to copy when it is added.
- Below 420px the topbar's back button drops the word "Menu" and keeps the
  arrow. With it, the button and the stat chips squeezed the title column to
  62px, wrapping both the level name and the board shape onto second lines and
  taking the topbar from 77px to 126px — nearly 60px off the board on an
  iPhone SE. The button keeps its accessible name either way.
