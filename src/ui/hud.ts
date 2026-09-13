function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`hud: missing #${id}`);
  return el as T;
}

export interface HudModel {
  level: number;
  /** The picture's name, shown as the title. */
  name: string;
  score: number;
  /** Tiles still on the picture. */
  tilesLeft: number;
  canUndo: boolean;
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

/** Few enough tiles left that the end is in sight. */
const NEARLY_DONE = 10;

export class Hud {
  private readonly levelName = required('level-name');
  private readonly levelSub = required('level-sub');
  private readonly score = required('stat-score');
  private readonly tiles = required('stat-tiles');
  private readonly tilesWrap = required('stat-tiles-wrap');

  private readonly overlay = required('overlay');
  private readonly overlayTitle = required('overlay-title');
  private readonly overlayScore = required('overlay-score');
  private readonly overlayBody = required('overlay-body');
  private readonly overlayAction = required<HTMLButtonElement>('overlay-action');
  private readonly overlaySecondary = required<HTMLButtonElement>('overlay-secondary');

  readonly undoButton = required<HTMLButtonElement>('btn-undo');
  readonly restartButton = required<HTMLButtonElement>('btn-restart');
  readonly settingsButton = required<HTMLButtonElement>('btn-settings');
  readonly menuButton = required<HTMLButtonElement>('btn-menu');
  readonly overlayMenuButton = required<HTMLButtonElement>('overlay-menu');

  update(model: HudModel): void {
    this.levelName.textContent = model.name;
    this.levelSub.textContent = `Level ${model.level}`;
    this.score.textContent = model.score.toLocaleString();
    this.tiles.textContent = String(model.tilesLeft);
    this.undoButton.disabled = !model.canUndo;
    // Nearly finished is worth flagging as encouragement.
    this.tilesWrap.classList.toggle('is-low', model.tilesLeft > 0 && model.tilesLeft <= NEARLY_DONE);
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

  get overlayElement(): HTMLElement {
    return this.overlay;
  }
}
