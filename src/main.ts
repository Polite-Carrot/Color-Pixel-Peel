import './style.css';

import { Game } from './core/game';
import type { Block } from './core/blocks';
import { tileAt } from './core/board';
import { LEVEL_COUNT } from './core/levels';
import type { ColorId } from './core/palette';
import {
  DEFAULT_PROGRESS,
  loadProgress,
  resetProgress,
  savePrefs,
  saveProgress,
  storeKind,
  storeWarning,
  type Progress,
} from './core/storage';
import { attachPointer } from './input/pointer';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import type { Slot } from './core/game';
import { Tray } from './ui/tray';
import * as modal from './ui/modal';
import { Screens } from './ui/screens';
import { Settings } from './ui/settings';
import { initNative, peelFeedback, rejectFeedback } from './native';

/** Let the lift-away animation finish before the card covers the board. */
const OVERLAY_DELAY_MS = 360;

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`boot: missing #${id}`);
  return el as T;
}

/**
 * Refuses the browser gestures that make an app feel like a web page.
 *
 * The viewport meta asks for no zoom, but iOS Safari has ignored
 * `user-scalable=no` since iOS 10, so pinch has to be refused directly.
 * `gesturestart` is WebKit's own pinch event and is what actually stops
 * it; the touchmove guard covers a two-finger pinch elsewhere. The
 * context menu is the long-press "copy / share" sheet, which has nothing
 * to offer on a board of tiles.
 *
 * Text selection and the callout are handled in CSS, on every element
 * rather than on body, since both inherit from whatever was touched.
 */
function refuseBrowserGestures(): void {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener('contextmenu', (event) => event.preventDefault());

  // A double tap that the CSS does not catch must not zoom either.
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) event.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
}

function boot(): void {
  const canvas = document.getElementById('board');
  const boardEl = document.querySelector('.board');
  if (!(canvas instanceof HTMLCanvasElement) || !(boardEl instanceof HTMLElement)) {
    throw new Error('boot: board elements missing');
  }

  let progress: Progress = loadProgress();
  let game = new Game(progress.unlockedLevel);
  const renderer = new Renderer(canvas, game.board);
  const hud = new Hud();
  const screens = new Screens();

  const howtoOverlay = required('overlay-howto');
  const howtoClose = required<HTMLButtonElement>('howto-close');
  const briefEl = required('brief');

  /* Every level is authored, so each carries its own briefing. */

  const tray = new Tray((i) => playBlock(i));

  let assist = progress.assist;
  let highlight: ColorId | null = null;
  /* While tiles are flying, the counters show the play part-way through
     rather than already finished. The model resolved the whole play the
     moment the block was put down — this is presentation over the top of
     it, which is why the rules stay synchronous and testable. */
  let flight: { slot: number; block: Block; taken: number; tilesAfter: number } | null = null;
  let frame = 0;
  let overlayTimer: number | undefined;

  /**
   * The panel as it should look right now: mid-flight, the block still
   * sits in its slot with its number draining, because the tiles it is
   * spending have not all left the picture yet.
   */
  const displaySlots = (): readonly Slot[] => {
    if (!flight) return game.slots;
    const left = Math.max(0, flight.block.count - renderer.flown);
    return game.slots.map((slot, i) =>
      i === flight?.slot ? { block: flight.block, remaining: Math.max(slot.remaining, left) } : slot,
    );
  };

  const syncHud = (): void => {
    briefEl.textContent = game.level.brief;
    hud.update({
      level: game.levelIndex,
      name: game.level.name,
      score: game.score,
      tilesLeft: game.tilesLeft + (flight ? flight.taken - renderer.flown : 0),
      canUndo: game.canUndo,
    });
    tray.render({
      columns: game.columns,
      slots: displaySlots(),
      playable: game.status === 'playing' && flight === null,
    });
  };

  const syncHome = (): void => {
    screens.updateHome({ level: progress.unlockedLevel, bestScore: progress.bestScore });
  };

  const draw = (): void => {
    frame = 0;
    renderer.draw({ assist, highlight });

    if (flight) {
      // Only the two numbers that change, rather than rebuilding the hand
      // sixty times a second.
      const flown = renderer.flown;
      hud.setTiles(game.tilesLeft + flight.taken - flown);
      tray.setSlotCount(flight.slot, Math.max(0, flight.block.count - flown));
      if (!renderer.busy) endFlight();
    }

    // Keep animating only while something is moving — a phone should not
    // burn battery on a static board.
    if (renderer.busy) requestFrame();
  };

  /** Tiles have all landed: show the real state and let play resume. */
  const endFlight = (): void => {
    if (!flight) return;
    flight = null;
    syncHud();
    if (game.status !== 'playing') {
      window.clearTimeout(overlayTimer);
      overlayTimer = window.setTimeout(showEndCard, OVERLAY_DELAY_MS);
    }
  };

  /** Lets a player who would rather not watch skip to the end. */
  const skipFlight = (): boolean => {
    if (!flight) return false;
    renderer.finishTakes();
    endFlight();
    requestFrame();
    return true;
  };

  /* A tap anywhere skips the wait, not only one that lands on a tile.
     Hit-testing the canvas alone meant a tap into the gap between tiles
     did nothing and the player was stuck watching. Capture phase, so it
     runs before whatever was actually tapped. */
  let tapSkipped = false;
  document.addEventListener(
    'pointerdown',
    () => {
      tapSkipped = skipFlight();
    },
    { capture: true },
  );

  const requestFrame = (): void => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(draw);
  };

  /* Publish the visual viewport height. dvh resolves to the viewport with
     the browser's toolbars retracted, and on iOS Safari those are drawn
     over the page, so a board sized to dvh runs underneath the toolbar.
     Safari also does not reliably fire `resize` when they come and go. */
  const publishViewport = (): void => {
    const vv = window.visualViewport;
    if (vv) document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
  };

  const resize = (): void => {
    publishViewport();
    const rect = boardEl.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    renderer.resize(rect.width, rect.height);
    requestFrame();
  };

  const refreshBoard = (): void => {
    flight = null;
    renderer.setBoard(game.board);
    renderer.clearAnims();
    syncHud();
    requestFrame();
  };

  const goHome = (): void => {
    window.clearTimeout(overlayTimer);
    hud.hideOverlay();
    syncHome();
    screens.show('home');
  };

  /** Starts a level from the picture list, or resumes the current one. */
  const startLevel = (index: number): void => {
    if (game.levelIndex !== index || game.status !== 'playing') {
      game = new Game(index, game.score);
      renderer.setBoard(game.board);
      renderer.clearAnims();
    }
    startPlaying();
  };

  const goLevels = (): void => {
    window.clearTimeout(overlayTimer);
    hud.hideOverlay();
    syncHome();
    screens.renderLevels(progress.unlockedLevel, startLevel);
    screens.show('levels');
  };

  const startPlaying = (): void => {
    screens.show('game');
    syncHud();
    // The board has only just been given a size, so measure it now.
    resize();
  };

  const showEndCard = (): void => {
    if (game.status === 'won') {
      progress = {
        ...progress,
        unlockedLevel: Math.max(progress.unlockedLevel, Math.min(game.levelIndex + 1, LEVEL_COUNT)),
        bestScore: Math.max(progress.bestScore, game.score),
      };
      saveProgress(progress);
      syncHome();

      hud.showOverlay(
        {
          title: 'Picture clear',
          score: game.score.toLocaleString(),
          body: `${game.level.name} — every tile taken.`,
          actionLabel: game.isLastLevel ? 'Back to the pictures' : 'Next level',
        },
        () => {
          if (game.isLastLevel) {
            goLevels();
            return;
          }
          game.nextLevel();
          refreshBoard();
          resize();
        },
      );
      return;
    }

    progress = { ...progress, bestScore: Math.max(progress.bestScore, game.score) };
    saveProgress(progress);
    syncHome();

    hud.showOverlay(
      {
        title: 'No way on from here',
        body: 'Every slot is holding a block with nothing to take. Step back a play, or start the picture again.',
        actionLabel: 'Restart picture',
        // Undo can only help if there is something to step back to.
        ...(game.canUndo ? { secondaryLabel: 'Undo last play' } : {}),
      },
      () => {
        game.restart();
        refreshBoard();
      },
      game.canUndo
        ? () => {
            game.undo();
            refreshBoard();
            // One step back out of a dead end can land on another one, so
            // re-check rather than assuming it helped.
            if (game.status !== 'playing') showEndCard();
          }
        : undefined,
    );
  };

  const playBlock = (column: number): void => {
    const outcome = game.place(column);

    if (outcome.kind === 'ignored') {
      rejectFeedback();
      return;
    }

    renderer.setBoard(game.board);

    if (outcome.taken.length === 0) {
      // Nothing to take: it is sitting in a slot waiting, which is worth
      // feeling, and there is nothing to animate.
      rejectFeedback();
      syncHud();
      requestFrame();
      if (outcome.status !== 'playing') {
        window.clearTimeout(overlayTimer);
        overlayTimer = window.setTimeout(showEndCard, OVERLAY_DELAY_MS);
      }
      return;
    }

    renderer.addTake(outcome.taken, outcome.block.color);
    peelFeedback(outcome.taken.length);
    flight = {
      slot: outcome.slot,
      block: outcome.block,
      taken: outcome.taken.length,
      tilesAfter: game.tilesLeft,
    };
    syncHud();
    requestFrame();
  };

  const settings = new Settings({
    getAssist: () => assist,
    setAssist: (value) => {
      assist = value;
      progress = { ...progress, assist };
      savePrefs(progress);
      requestFrame();
    },
    storeNote: () => storeWarning(),
    describeProgress: () =>
      progress.unlockedLevel > 1 || progress.bestScore > 0
        ? `level ${progress.unlockedLevel} and your best score of ${progress.bestScore.toLocaleString()}`
        : 'your progress',
    onReset: () => {
      resetProgress();
      progress = { ...DEFAULT_PROGRESS, assist };
      game = new Game(progress.unlockedLevel);
      refreshBoard();
      syncHome();
    },
  });

  /* The picture is not where moves are made — blocks are. Tapping it
     instead picks out one color, dimming the rest, which is how a player
     finds where a color actually is before spending a block on it. */
  attachPointer(canvas, (x, y) => renderer.hitTest(x, y), {
    onPress: () => {},
    onTap: (cell) => {
      // The tap that skipped a flight should not also pick out a color.
      if (tapSkipped) {
        tapSkipped = false;
        return;
      }
      const color = tileAt(game.board, cell);
      highlight = color === highlight ? null : color;
      requestFrame();
    },
    onCancel: () => {},
  });

  /* Home goes to the picture list rather than straight into a level, so
     a finished one can be played again. */
  screens.playButton.addEventListener('click', goLevels);
  screens.levelsBackButton.addEventListener('click', goHome);

  screens.howtoButton.addEventListener('click', () => modal.open(howtoOverlay, howtoClose));
  howtoClose.addEventListener('click', () => modal.close(howtoOverlay));
  screens.settingsButton.addEventListener('click', () => settings.open());
  hud.settingsButton.addEventListener('click', () => settings.open());
  hud.menuButton.addEventListener('click', goLevels);
  hud.overlayMenuButton.addEventListener('click', goLevels);

  hud.undoButton.addEventListener('click', () => {
    if (!game.undo()) return;
    window.clearTimeout(overlayTimer);
    hud.hideOverlay();
    refreshBoard();
  });

  hud.restartButton.addEventListener('click', () => {
    window.clearTimeout(overlayTimer);
    hud.hideOverlay();
    game.restart();
    refreshBoard();
  });

  /* Escape dismisses the top-most dialog. On the end card it dismisses
     onto the board rather than to the menu: someone may want to look at
     the board before choosing, and the card comes back on the next move,
     with undo and restart still on the toolbar. */
  modal.onEscape([
    { overlay: settings.element, dismiss: () => settings.close() },
    { overlay: howtoOverlay, dismiss: () => modal.close(howtoOverlay) },
    { overlay: hud.overlayElement, dismiss: () => hud.hideOverlay() },
  ]);

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(boardEl);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('scroll', publishViewport);

  publishViewport();
  syncHome();
  syncHud();
  screens.show('home');
  screens.showSaveWarning(storeWarning(), storeKind);
  refuseBrowserGestures();
  void initNative();

  // The letter marks are drawn in Baloo 2, which may not have arrived by
  // the first frame — redraw once it has, or they render in a fallback.
  document.fonts?.ready.then(requestFrame).catch(() => {});

}

boot();
