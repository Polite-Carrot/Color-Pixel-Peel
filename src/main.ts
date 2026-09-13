import './style.css';

import { Game } from './core/game';
import { loadProgress, saveProgress, type Progress } from './core/storage';
import { attachPointer } from './input/pointer';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { initNative, peelFeedback, rejectFeedback } from './native';

/** Let the peel animation finish before the overlay covers the board. */
const OVERLAY_DELAY_MS = 340;

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

  let symbols = progress.symbols;
  let pressed: number | null = null;
  let frame = 0;
  let overlayTimer: number | undefined;

  const persist = (patch: Partial<Progress>): void => {
    progress = { ...progress, ...patch };
    saveProgress(progress);
  };

  const syncHud = (): void => {
    hud.update({
      level: game.levelIndex,
      score: game.score,
      movesLeft: game.movesLeft,
      best: Math.max(progress.bestScore, game.score),
      canUndo: game.canUndo,
      symbols,
    });
  };

  const draw = (): void => {
    frame = 0;
    renderer.draw({ symbols, pressed });
    // Keep animating only while something is moving — a phone should not
    // burn battery on a static board.
    if (renderer.busy) requestFrame();
  };

  const requestFrame = (): void => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(draw);
  };

  const resize = (): void => {
    const rect = boardEl.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    renderer.resize(rect.width, rect.height);
    requestFrame();
  };

  const showEndOverlay = (): void => {
    if (game.status === 'won') {
      persist({
        unlockedLevel: Math.max(progress.unlockedLevel, game.levelIndex + 1),
        bestScore: Math.max(progress.bestScore, game.score),
      });
      hud.showOverlay(
        {
          title: 'Level clear',
          body: `+${game.levelScore.toLocaleString()} points with ${game.movesLeft} move${
            game.movesLeft === 1 ? '' : 's'
          } to spare.`,
          actionLabel: 'Next level',
        },
        () => {
          game.nextLevel();
          renderer.setBoard(game.board);
          renderer.clearAnims();
          resize();
          syncHud();
        },
      );
      return;
    }

    persist({ bestScore: Math.max(progress.bestScore, game.score) });
    hud.showOverlay(
      {
        title: game.lossReason === 'no-moves' ? 'No moves left' : 'Out of moves',
        body:
          game.lossReason === 'no-moves'
            ? 'Every remaining region is a single pixel. Undo a step, or restart the level.'
            : 'The move limit ran out before the board was clear.',
        actionLabel: 'Try again',
      },
      () => {
        game.restart();
        renderer.setBoard(game.board);
        renderer.clearAnims();
        syncHud();
        requestFrame();
      },
    );
  };

  const handleTap = (cell: number): void => {
    const outcome = game.tap(cell);

    if (outcome.kind === 'ignored') {
      rejectFeedback();
      return;
    }

    // Animate the old layer flying off, on top of the new board state.
    renderer.setBoard(game.board);
    renderer.addPeel(outcome.peeled, outcome.color);
    peelFeedback(outcome.peeled.length);
    syncHud();
    requestFrame();

    if (outcome.status !== 'playing') {
      window.clearTimeout(overlayTimer);
      overlayTimer = window.setTimeout(showEndOverlay, OVERLAY_DELAY_MS);
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
    renderer.setBoard(game.board);
    renderer.clearAnims();
    syncHud();
    requestFrame();
  });

  hud.restartButton.addEventListener('click', () => {
    window.clearTimeout(overlayTimer);
    hud.hideOverlay();
    game.restart();
    renderer.setBoard(game.board);
    renderer.clearAnims();
    syncHud();
    requestFrame();
  });

  hud.symbolsButton.addEventListener('click', () => {
    symbols = !symbols;
    persist({ symbols });
    syncHud();
    requestFrame();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(boardEl);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  resize();
  syncHud();
  void initNative();

  // Dev-only handle for debugging and end-to-end tests: it exposes the
  // live game plus the cell geometry needed to aim a tap. Stripped from
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
