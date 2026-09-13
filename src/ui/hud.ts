function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`hud: missing #${id}`);
  return el as T;
}

export interface HudModel {
  level: number;
  score: number;
  movesLeft: number;
  best: number;
  canUndo: boolean;
  symbols: boolean;
}

export interface OverlayModel {
  title: string;
  body: string;
  actionLabel: string;
}

export class Hud {
  private readonly level = required('stat-level');
  private readonly score = required('stat-score');
  private readonly moves = required('stat-moves');
  private readonly movesWrap = required('stat-moves-wrap');
  private readonly best = required('stat-best');

  private readonly overlay = required('overlay');
  private readonly overlayTitle = required('overlay-title');
  private readonly overlayBody = required('overlay-body');
  private readonly overlayAction = required<HTMLButtonElement>('overlay-action');

  readonly undoButton = required<HTMLButtonElement>('btn-undo');
  readonly restartButton = required<HTMLButtonElement>('btn-restart');
  readonly symbolsButton = required<HTMLButtonElement>('btn-symbols');

  update(model: HudModel): void {
    this.level.textContent = String(model.level);
    this.score.textContent = model.score.toLocaleString();
    this.moves.textContent = String(model.movesLeft);
    this.best.textContent = model.best.toLocaleString();
    this.undoButton.disabled = !model.canUndo;
    this.symbolsButton.setAttribute('aria-pressed', String(model.symbols));
    // Warn once the player is down to their last few moves.
    this.movesWrap.classList.toggle('hud__stat--warn', model.movesLeft <= 3);
  }

  showOverlay(model: OverlayModel, onAction: () => void): void {
    this.overlayTitle.textContent = model.title;
    this.overlayBody.textContent = model.body;
    this.overlayAction.textContent = model.actionLabel;
    this.overlayAction.onclick = () => {
      this.hideOverlay();
      onAction();
    };
    this.overlay.hidden = false;
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
    this.overlayAction.onclick = null;
  }
}
