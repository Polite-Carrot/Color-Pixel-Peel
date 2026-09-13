import { LEVELS, LEVEL_COUNT } from '../core/levels';
import type { StoreKind } from '../core/storage';

export type ScreenName = 'home' | 'levels' | 'game';

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
  private readonly levels = required('screen-levels');
  private readonly game = required('screen-game');
  private readonly grid = required('level-grid');
  private readonly progress = required('levels-progress');
  private readonly homeSub = required('home-sub');
  private readonly saveWarning = required('save-warning');

  readonly playButton = required<HTMLButtonElement>('go-play');
  readonly howtoButton = required<HTMLButtonElement>('go-howto');
  readonly settingsButton = required<HTMLButtonElement>('go-settings');
  readonly levelsBackButton = required<HTMLButtonElement>('levels-back');

  private active: ScreenName = 'home';

  get current(): ScreenName {
    return this.active;
  }

  show(name: ScreenName): void {
    this.active = name;
    this.home.classList.toggle('is-active', name === 'home');
    this.levels.classList.toggle('is-active', name === 'levels');
    this.game.classList.toggle('is-active', name === 'game');
    // The board is sized to the window while it is on screen.
    document.body.classList.toggle('playing', name === 'game');
  }

  /**
   * Draws the picture list. Everything up to the highest level reached
   * can be replayed, the next one is picked out in gold, and the rest are
   * shown but locked — so the list says how much game there is, not just
   * how much of it you have seen.
   */
  renderLevels(unlockedLevel: number, onPick: (index: number) => void): void {
    const reached = Math.min(unlockedLevel, LEVEL_COUNT);
    const done = Math.max(0, Math.min(unlockedLevel - 1, LEVEL_COUNT));
    this.progress.textContent = `${done} of ${LEVEL_COUNT} cleared`;

    this.grid.replaceChildren(
      ...LEVELS.map((def, i) => {
        const index = i + 1;
        const locked = index > reached;
        const isNext = index === reached && index > done;

        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tile${isNext ? ' is-next' : ''}`;
        button.disabled = locked;

        const no = document.createElement('span');
        no.className = 'tile__no';
        no.textContent = String(index);

        const name = document.createElement('span');
        name.className = 'tile__name';
        name.textContent = def.name;

        const state = document.createElement('span');
        state.className = 'tile__state';
        state.textContent = locked ? '🔒' : index < reached ? '✓' : '';

        button.append(no, name, state);
        button.setAttribute(
          'aria-label',
          locked
            ? `Level ${index}, ${def.name} — locked`
            : `Level ${index}, ${def.name}${index < reached ? ', cleared' : ''}`,
        );
        if (!locked) button.addEventListener('click', () => onPick(index));

        item.append(button);
        return item;
      }),
    );
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
