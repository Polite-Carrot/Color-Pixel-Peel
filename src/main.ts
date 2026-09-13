import './style.css';

import { Game } from './core/game';
import {
  loadProgress,
  savePrefs,
  saveProgress,
  storeWarning,
  type Progress,
} from './core/storage';
import { attachPointer } from './input/pointer';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { initNative, peelFeedback, rejectFeedback } from './native';

/** Let the lift-away animation finish before the card covers the board. */
const OVERLAY_DELAY_MS = 360;

function boot(): void {
  const canvas = document.getElementById('board');
  const boardEl = document.querySelector('.board');
  if (!(canvas instanceof HTMLCanvasElement) || !(boardEl instanceof HTMLElement)) {
    throw new Error('boot: board elements missing');
  }

  let progress: Progress = loadProgress();
  const game = new Game(progress.unlockedLevel);
  const renderer = new Renderer(canvas, game.board);
  const hud = new Hud();

  let assist = progress.assist;
  let pressed: number | null = null;
  let frame = 0;
  let overlayTimer: number | undefined;

  const syncHud = (): void => {
    hud.update({
      level: game.levelIndex,
      score: game.score,
      movesLeft: game.movesLeft,
      best: Math.max(progress.bestScore, game.score),
      canUndo: game.canUndo,
      assist,
      cols: game.board.cols,
      rows: game.board.rows,
      colors: game.level.config.colors,
    });
  };

  const draw = (): void => {
    frame = 0;
    renderer.draw({ assist, pressed });
    // Keep animating only while something is moving — a phone should not
    // burn battery on a static board.
    if (renderer.busy) requestFrame();
  };

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
    renderer.setBoard(game.board);
    renderer.clearAnims();
    syncHud();
    requestFrame();
  };

  const showEndCard = (): void => {
    if (game.status === 'won') {
      progress = {
        ...progress,
        unlockedLevel: Math.max(progress.unlockedLevel, game.levelIndex + 1),
        bestScore: Math.max(progress.bestScore, game.score),
      };
      saveProgress(progress);

      hud.showOverlay(
        {
          title: 'Level clear',
          score: `+${game.levelScore.toLocaleString()}`,
          body: `Cleared with ${game.movesLeft} move${game.movesLeft === 1 ? '' : 's'} to spare.`,
          actionLabel: 'Next level',
        },
        () => {
          game.nextLevel();
          refreshBoard();
          resize();
        },
      );
      return;
    }

    progress = { ...progress, bestScore: Math.max(progress.bestScore, game.score) };
    saveProgress(progress);

    const stranded = game.lossReason === 'no-moves';
    hud.showOverlay(
      {
        title: stranded ? 'No way on from here' : 'Out of moves',
        body: stranded
          ? 'Every run left is a single pixel. Step back a peel, or start the level again.'
          : 'The move limit ran out before the board was clear.',
        actionLabel: 'Restart level',
        // Undo can only help if there is something to step back to.
        ...(game.canUndo ? { secondaryLabel: 'Undo last peel' } : {}),
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

  const handleTap = (cell: number): void => {
    const outcome = game.tap(cell);

    if (outcome.kind === 'ignored') {
      rejectFeedback();
      return;
    }

    // Animate the old layer lifting away, on top of the new board state.
    renderer.setBoard(game.board);
    renderer.addPeel(outcome.peeled, outcome.color);
    peelFeedback(outcome.peeled.length);
    syncHud();
    requestFrame();

    if (outcome.status !== 'playing') {
      window.clearTimeout(overlayTimer);
      overlayTimer = window.setTimeout(showEndCard, OVERLAY_DELAY_MS);
    }
  };

  attachPointer(canvas, (x, y) => renderer.hitTest(x, y), {
    onPress: (cell) => {
      pressed = cell;
      requestFrame();
    },
    onTap: handleTap,
    onCancel: () => {
      pressed = null;
      requestFrame();
    },
  });

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

  hud.assistButton.addEventListener('click', () => {
    assist = !assist;
    progress = { ...progress, assist };
    savePrefs(progress);
    syncHud();
    requestFrame();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(boardEl);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('scroll', publishViewport);

  resize();
  syncHud();
  hud.showSaveWarning(storeWarning());
  void initNative();

  // The letter marks are drawn in Baloo 2, which may not have arrived by
  // the first frame — redraw once it has, or they render in a fallback.
  document.fonts?.ready.then(requestFrame).catch(() => {});

  // Dev-only handle for debugging and end-to-end tests: it exposes the live
  // game plus the cell geometry needed to aim a tap. Stripped from
  // production builds by the `import.meta.env.DEV` guard.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__peel = {
      game,
      solution: () => [...game.level.solution],
      cellRect: (cell: number) => renderer.cellRect(cell),
      canvasOrigin: () => canvas.getBoundingClientRect(),
    };
  }
}

boot();
