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
  assist: boolean;
  /** Board shape, shown as the subtitle. */
  cols: number;
  rows: number;
  colors: number;
}

export interface OverlayModel {
  title: string;
  /** Big figure on the card — the score, or blank. */
  score?: string;
  body: string;
  actionLabel: string;
  /** Offered only when it can actually help. */
  secondaryLabel?: string;
}

/** The last few moves are worth flagging before they run out. */
const LOW_MOVES = 3;

export class Hud {
  private readonly levelName = required('level-name');
  private readonly levelSub = required('level-sub');
  private readonly score = required('stat-score');
  private readonly moves = required('stat-moves');
  private readonly movesWrap = required('stat-moves-wrap');
  private readonly best = required('stat-best');
  private readonly saveWarning = required('save-warning');

  private readonly overlay = required('overlay');
  private readonly overlayTitle = required('overlay-title');
  private readonly overlayScore = required('overlay-score');
  private readonly overlayBody = required('overlay-body');
  private readonly overlayAction = required<HTMLButtonElement>('overlay-action');
  private readonly overlaySecondary = required<HTMLButtonElement>('overlay-secondary');

  readonly undoButton = required<HTMLButtonElement>('btn-undo');
  readonly restartButton = required<HTMLButtonElement>('btn-restart');
  readonly assistButton = required<HTMLButtonElement>('btn-assist');

  update(model: HudModel): void {
    this.levelName.textContent = `Level ${model.level}`;
    /* Deliberately the board's shape rather than a move target. The moves
       chip already carries what is left, and the generated solution length
       is *a* solution rather than a proven minimum — so it is never called
       par here, which in Color Match means the fewest moves possible. */
    this.levelSub.textContent =
      `${model.cols} × ${model.rows} · ${model.colors} color${model.colors === 1 ? '' : 's'}`;
    this.score.textContent = model.score.toLocaleString();
    this.moves.textContent = String(model.movesLeft);
    this.best.textContent = model.best.toLocaleString();
    this.undoButton.disabled = !model.canUndo;
    this.assistButton.setAttribute('aria-pressed', String(model.assist));
    this.movesWrap.classList.toggle('is-low', model.movesLeft <= LOW_MOVES);
  }

  /** Says which store progress landed in, when it is not the good one. */
  showSaveWarning(message: string | null): void {
    if (!message) {
      this.saveWarning.hidden = true;
      return;
    }
    this.saveWarning.textContent = message;
    this.saveWarning.hidden = false;
  }

  showOverlay(model: OverlayModel, onAction: () => void, onSecondary?: () => void): void {
    this.overlayTitle.textContent = model.title;
    this.overlayScore.textContent = model.score ?? '';
    this.overlayScore.hidden = !model.score;
    this.overlayBody.textContent = model.body;
    this.overlayAction.textContent = model.actionLabel;
    this.overlayAction.onclick = () => {
      this.hideOverlay();
      onAction();
    };

    // Undo is the gentlest way out of a lost board, so it leads — but it is
    // hidden when there is nothing to undo, since a button that cannot help
    // is worse than no button.
    if (model.secondaryLabel && onSecondary) {
      this.overlaySecondary.textContent = model.secondaryLabel;
      this.overlaySecondary.hidden = false;
      this.overlaySecondary.onclick = () => {
        this.hideOverlay();
        onSecondary();
      };
    } else {
      this.overlaySecondary.hidden = true;
      this.overlaySecondary.onclick = null;
    }

    this.overlay.hidden = false;
    // Focus the action without scrolling the card, so a long card cannot
    // open partway down itself.
    this.overlayAction.focus({ preventScroll: true });
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
    this.overlayAction.onclick = null;
    this.overlaySecondary.onclick = null;
  }

  get overlayVisible(): boolean {
    return !this.overlay.hidden;
  }
}
