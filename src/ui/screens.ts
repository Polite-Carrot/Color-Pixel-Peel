import type { StoreKind } from '../core/storage';

export type ScreenName = 'home' | 'game';

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`screens: missing #${id}`);
  return el as T;
}

export interface HomeModel {
  /** Highest level unlocked — where Play will pick up. */
  level: number;
  bestScore: number;
}

/**
 * Home and the board are two screens in one document. There is one mode,
 * so home is a masthead, a single way in, and the footer pair — rather
 * than Color Match's grid of four.
 */
export class Screens {
  private readonly home = required('screen-home');
  private readonly game = required('screen-game');
  private readonly homeSub = required('home-sub');
  private readonly saveWarning = required('save-warning');

  readonly playButton = required<HTMLButtonElement>('go-play');
  readonly howtoButton = required<HTMLButtonElement>('go-howto');
  readonly settingsButton = required<HTMLButtonElement>('go-settings');

  private active: ScreenName = 'home';

  get current(): ScreenName {
    return this.active;
  }

  show(name: ScreenName): void {
    this.active = name;
    this.home.classList.toggle('is-active', name === 'home');
    this.game.classList.toggle('is-active', name === 'game');
    // The board is sized to the window while it is on screen.
    document.body.classList.toggle('playing', name === 'game');
  }

  updateHome(model: HomeModel): void {
    const resume = model.level > 1 ? `Continue at level ${model.level}` : 'Start at level 1';
    const best = model.bestScore > 0 ? ` · best ${model.bestScore.toLocaleString()}` : '';
    this.homeSub.textContent = `${resume}${best}`;
  }

  /** Says which store progress landed in, when it is not the good one. */
  showSaveWarning(message: string | null, _kind: StoreKind): void {
    if (!message) {
      this.saveWarning.hidden = true;
      return;
    }
    this.saveWarning.textContent = message;
    this.saveWarning.hidden = false;
  }
}
