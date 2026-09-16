import { UNLOCK_ALL_LEVELS } from '../config';
import { LEVEL_COUNT, type LevelSummary, levelSummaries } from '../core/levels';
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
   *
   * Five hundred tiles is too long a scroll to hand over as one run, so
   * each setting gets a heading that says how far through it you are, and
   * opening the list jumps to the level you are actually on.
   */
  renderLevels(unlockedLevel: number, onPick: (index: number) => void): void {
    const reached = Math.min(unlockedLevel, LEVEL_COUNT);
    const done = Math.max(0, Math.min(unlockedLevel - 1, LEVEL_COUNT));
    /* The count is still what you have cleared, not what you can open, so
       it stays true while the test switch is on. What the switch is doing
       is said on its own line below rather than appended here, where at
       phone width it wrapped the subhead onto three lines and squeezed the
       Menu button. */
    this.progress.textContent = `${done} of ${LEVEL_COUNT} cleared`;
    this.showTestNote();

    const summaries = levelSummaries();
    const runs = new Map<string, number>();
    for (const summary of summaries) {
      runs.set(summary.setting, (runs.get(summary.setting) ?? 0) + 1);
    }

    const items: HTMLLIElement[] = [];
    let heading: string | null = null;

    for (const summary of summaries) {
      if (summary.setting !== heading) {
        heading = summary.setting;
        items.push(this.settingHeading(heading, runs.get(heading) ?? 0, done, summary.index));
      }
      items.push(this.levelTile(summary, reached, done, onPick));
    }

    this.grid.replaceChildren(...items);
  }

  /**
   * Says on screen that the build is handing out every level.
   *
   * Built here rather than written into index.html, so that setting
   * UNLOCK_ALL_LEVELS back to false takes the notice with it instead of
   * leaving dead markup behind.
   */
  private showTestNote(): void {
    const existing = document.getElementById('levels-test-note');
    if (!UNLOCK_ALL_LEVELS) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const note = document.createElement('p');
    note.id = 'levels-test-note';
    note.className = 'status status--test';
    note.textContent = 'Test build \u2014 every level is open, however far you have got.';
    this.grid.before(note);
  }

  /** A full-width rule between one setting's run of levels and the next. */
  private settingHeading(name: string, length: number, done: number, first: number): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'level-head';

    const label = document.createElement('b');
    label.textContent = name;

    /* How much of this run is behind you, rather than of the campaign —
       "12 of 100" is the number you want while you are inside a run. */
    const cleared = Math.max(0, Math.min(done - (first - 1), length));
    const count = document.createElement('span');
    count.textContent = `${cleared} of ${length}`;

    item.append(label, count);
    return item;
  }

  private levelTile(
    summary: LevelSummary,
    reached: number,
    done: number,
    onPick: (index: number) => void,
  ): HTMLLIElement {
    const index = summary.index;
    /* Reached is still where progress has got to — it is what picks out
       the next level in gold and ticks the ones behind it. The switch
       only decides whether a tile further on can be pressed. */
    const locked = index > reached && !UNLOCK_ALL_LEVELS;
    const isNext = index === reached && index > done;

    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tile${isNext ? ' is-next' : ''}`;
    button.disabled = locked;
    if (isNext) button.dataset.next = 'true';

    const no = document.createElement('span');
    no.className = 'tile__no';
    no.textContent = String(index);

    const name = document.createElement('span');
    name.className = 'tile__name';
    name.textContent = summary.name;

    const state = document.createElement('span');
    state.className = 'tile__state';
    state.textContent = locked ? '🔒' : index < reached ? '✓' : '';
    /* Open, but not yet earned: worth looking different from a level you
       actually reached, so the list still reads as progress rather than as
       five hundred identical tiles. */
    if (!locked && index > reached) button.classList.add('is-ahead');

    /* The setting is on the heading above the run rather than on every
       tile in it: five hundred tiles each repeating the same word is
       noise, and the tile has the level number and the picture to carry.
       It stays in the label, where someone arriving by screen reader has
       no heading in view to read it from. */
    button.append(no, name, state);
    button.setAttribute(
      'aria-label',
      locked
        ? `Level ${index}, ${summary.name}, ${summary.setting} — locked`
        : `Level ${index}, ${summary.name}, ${summary.setting}${
            index < reached ? ', cleared' : index > reached ? ', not reached yet' : ''
          }`,
    );
    if (!locked) button.addEventListener('click', () => onPick(index));

    item.append(button);
    return item;
  }

  /**
   * Puts the level you are on in the middle of the list.
   *
   * At level 300 the tile is eleven thousand pixels down, so opening the
   * list at the top would mean scrolling past six runs of cleared levels
   * to find it. Called after the screen is showing, because a hidden
   * element has no layout to scroll to.
   */
  revealNextLevel(): void {
    const next = this.grid.querySelector<HTMLElement>('.tile[data-next]');
    if (!next) return;
    const item = next.parentElement ?? next;
    const middle = item.offsetTop - (this.grid.clientHeight - item.offsetHeight) / 2;
    this.grid.scrollTop = Math.max(0, middle);
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
