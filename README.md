# Color Pixel Peel

A mobile puzzle game for iOS and Android, in the same visual world as
**Color Match & Merge**. Built as a TypeScript canvas game with
[Vite](https://vite.dev), wrapped in native shells with
[Capacitor](https://capacitorjs.com) so both stores ship from one codebase.

## The mechanic

Every cell on the board is a **stack of colored pixel layers**. You only see
the top one.

- **Tap a cell** and the 4-connected region sharing that top color *peels off*,
  revealing whatever colors were underneath.
- A region needs **at least 2 cells** to peel. Lone pixels are stuck.
- Cells that run out of layers become **holes**, which break connectivity
  between their neighbours — so the order you peel in changes what is
  reachable later.
- **Clear the whole board** before the move limit runs out.

Scoring is quadratic in region size (`5 × n²`), so one big peel beats several
small ones, plus a clear bonus that rewards unused moves.

## Every level is provably solvable

Random boards deadlock. Instead of generating a board and hoping, the generator
builds each level **backwards**:

1. Start from an empty board.
2. Repeatedly stamp a small connected blob with a color chosen so that **no
   neighbouring cell already shows that color** — making the blob a *maximal*
   same-color region.
3. Record the stamp order.

Because each stamp is maximal at the moment it is placed, tapping it peels
*exactly* that blob and nothing more. So replaying the stamps in reverse order
peels every layer back off, and the reverse of the stamp order **is** a
solution. `generateLevel` then runs that solution through the real `peel`
function via `verifySolution` and throws rather than ship a dead level.

**That length is not par, and is deliberately never called par.** In Color
Match par means the fewest moves possible, proven by exhausting everything
cheaper. Here it is only the solution the generator happened to build — a
board may well be clearable in fewer. Claiming otherwise would need a search
this game does not have, so the topbar shows the board's shape instead and the
move limit is that solution's length plus ~35% slack. `Undo` is unlimited, so
imperfect play is recoverable either way.

Levels are keyed by a stable seed (`seedForLevel`), so level 7 is the same
board for every player on every device.

## Shared with Color Match & Merge

This is meant to read as coming from the same place, so the parts that carry
that identity are taken from that repo rather than reinvented:

| | Shared |
|--|--------|
| `public/fonts.css` | The inlined Nunito and Baloo 2 subsets, copied as-is. Committed there for the same reason it is committed here: regenerating it needs network access, and the game should build and run without any. |
| `public/assets/polite-carrot-*.svg` | The startup lockup's mark and name, so both games open on the same black screen. |
| `src/style.css` | The design tokens verbatim — sky gradient, paper and ink, `--lift` / `--stroke` / `--radius` — and the component recipes built on them: 3px ink outlines, hard unblurred drop shadows, buttons that press into the page. |
| `src/core/palette.ts` | The color hexes, their letter marks, and the luminance rule that picks dark or light ink for a mark. |

Two conventions came with it:

- **Deliberately single-theme.** There are no `prefers-color-scheme` blocks: a
  game screen is a place, not a document. Every color is painted explicitly,
  including the ground, so the page holds whatever the host paints behind it.
- **US spelling in anything a player reads** — *color*, never *colour*.

### The palette, and the clash it avoids

Color Match requires any two colors on one board to sit at least **150** apart
on the rough perceptual measure in its `js/colour.js`. That measure and the
figure are both reused here, and `palette.test.ts` checks something slightly
stronger: early levels use only the first few entries, so **every prefix** of
the list has to clear 150, not just the list as a whole. The order is
primaries-first — matching the three jars on Color Match's masthead — and the
tightest prefix pair is blue/purple at 157.

`teal` (#0ec3c6) is left out of the nine. It sits 103 from this list's cyan,
which is the palette clash that game's README still records as open. Omitting
it means no board here can deal the pair at all, rather than relying on a
generator check to keep them apart.

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

## Running it

```bash
npm install
npm run dev        # dev server (also exposes window.__peel for debugging)
npm test           # 67 unit tests over the game core
npm run typecheck
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle
```

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

`npm run sync` (`build` + `cap sync`) is the command to re-run after any web
change. Commit the generated `ios/` and `android/` directories once they
exist, as Capacitor intends — they carry the icons, splash screens and signing
configuration. `.gitignore` already excludes their build output and fetched
dependencies.

App identity lives in `capacitor.config.ts` (`appId`
`com.politecarrot.colorpixelpeel`). The native background is **black** rather
than sky, to match the startup lockup the page opens on, so the native launch
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
    level.ts       # reverse-peel generator + solution verifier
    game.ts        # score, moves, undo, win/lose, level progression
    storage.ts     # progress, and whether it can be trusted
  render/renderer.ts   # DPR-aware canvas drawing + the lift-away animation
  input/pointer.ts     # pointer/touch → cell, with drag-slop rejection
  ui/hud.ts            # topbar, toolbar and the win/loss card
  native.ts            # Capacitor status bar + haptics, all optional
  main.ts              # wiring
public/
  fonts.css            # shared, committed: Nunito + Baloo 2, inlined
  assets/              # shared: the Polite Carrot lockup
```

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

- **No home screen.** Color Match opens on a menu of modes; this opens straight
  onto level 1. The chrome, cards and buttons are the shared ones, so adding a
  masthead and menu is styling that already exists rather than new design.
- The move limit is not a proven par — see above. A real par would need a
  search over peel states, which this game does not have.
- `npm audit` reports a moderate advisory in `uuid`, reached via
  `xcode` ← `@capacitor/cli`. It is a dev-only dependency used to generate the
  Xcode project and is not part of the shipped app; the only available fix is a
  breaking CLI downgrade.
- Difficulty on early levels is driven mostly by board size: full coverage
  needs a certain number of stamps, so `targetMoves` only starts to bind on
  later levels.
- No sound. Color Match makes its blips with oscillators rather than audio
  files, which is the approach to copy when it is added.
