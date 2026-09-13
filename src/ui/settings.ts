import { Hold } from './hold';
import * as modal from './modal';

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`settings: missing #${id}`);
  return el as T;
}

/** Six seconds of held intent before a hundred levels go. */
const HOLD_MS = 6000;

export interface SettingsDeps {
  getAssist(): boolean;
  setAssist(value: boolean): void;
  /** Null when progress is being kept properly. */
  storeNote(): string | null;
  /** What the player stands to lose, for the confirmation copy. */
  describeProgress(): string;
  /** Wipe it. Called only after the full hold. */
  onReset(): void;
}

/**
 * Sound, assist and reset live in one dialog in Color Match, reachable
 * from home and from the board so any of them can be changed without
 * leaving a level. Same here, minus sound, which this game does not have
 * yet.
 */
export class Settings {
  private readonly overlay = required('overlay-settings');
  private readonly assistButton = required<HTMLButtonElement>('set-assist');
  private readonly storeRow = required('store-row');
  private readonly storeNote = required('store-note');
  private readonly closeButton = required<HTMLButtonElement>('settings-close');

  private readonly resetButton = required<HTMLButtonElement>('set-reset');
  private readonly confirmStep = required('reset-confirm-step');
  private readonly confirmText = required('reset-confirm-text');
  private readonly cancelButton = required<HTMLButtonElement>('reset-cancel');
  private readonly continueButton = required<HTMLButtonElement>('reset-continue');
  private readonly holdStep = required('reset-hold-step');
  private readonly holdButton = required<HTMLButtonElement>('reset-hold');
  private readonly holdLabel = required('reset-hold-label');

  private readonly hold = new Hold(HOLD_MS);
  private raf = 0;

  constructor(private readonly deps: SettingsDeps) {
    this.assistButton.addEventListener('click', () => {
      this.deps.setAssist(!this.deps.getAssist());
      this.syncAssist();
    });

    this.closeButton.addEventListener('click', () => this.close());

    this.resetButton.addEventListener('click', () => {
      this.confirmText.textContent = `This erases ${this.deps.describeProgress()}. It cannot be undone.`;
      this.confirmStep.hidden = false;
      this.holdStep.hidden = true;
      this.cancelButton.focus({ preventScroll: true });
    });

    this.cancelButton.addEventListener('click', () => this.resetSteps());

    this.continueButton.addEventListener('click', () => {
      this.confirmStep.hidden = true;
      this.holdStep.hidden = false;
      this.paint(0, 'Press and hold');
      this.holdButton.focus({ preventScroll: true });
    });

    this.wireHold();
  }

  private wireHold(): void {
    const begin = (): void => {
      this.hold.start();
      if (this.raf === 0) this.raf = requestAnimationFrame(() => this.tick());
    };
    const end = (): void => {
      if (this.hold.done) return;
      this.hold.release();
      this.stopTicking();
      this.paint(0, 'Press and hold');
    };

    this.holdButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      // Capture, so a finger sliding off the button still counts as
      // holding rather than silently cancelling.
      try {
        this.holdButton.setPointerCapture(event.pointerId);
      } catch {
        // Best-effort; the pointerup path works without it.
      }
      begin();
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      this.holdButton.addEventListener(type, end);
    }
    this.holdButton.addEventListener('keydown', (event) => {
      if (event.repeat) return; // a key repeating is not a key being held
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        begin();
      }
    });
    this.holdButton.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Enter') end();
    });
    this.holdButton.addEventListener('blur', end);
  }

  private tick(): void {
    this.raf = 0;
    if (this.hold.tick()) {
      this.holdButton.classList.add('is-done');
      this.paint(1, 'Progress erased');
      this.deps.onReset();
      return;
    }
    if (!this.hold.running) return;
    this.paint(this.hold.fraction(), `Keep holding… ${this.hold.secondsLeft()}`);
    this.raf = requestAnimationFrame(() => this.tick());
  }

  private stopTicking(): void {
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private paint(fraction: number, label: string): void {
    this.holdButton.style.setProperty('--held', String(fraction));
    this.holdLabel.textContent = label;
  }

  private resetSteps(): void {
    this.stopTicking();
    this.hold.reset();
    this.holdButton.classList.remove('is-done');
    this.paint(0, 'Press and hold');
    this.confirmStep.hidden = true;
    this.holdStep.hidden = true;
  }

  private syncAssist(): void {
    const on = this.deps.getAssist();
    this.assistButton.setAttribute('aria-pressed', String(on));
    this.assistButton.textContent = on ? 'On' : 'Off';
  }

  open(): void {
    this.resetSteps();
    this.syncAssist();

    const note = this.deps.storeNote();
    if (note) {
      this.storeNote.textContent = note;
      this.storeRow.hidden = false;
    } else {
      this.storeRow.hidden = true;
    }

    modal.open(this.overlay, this.closeButton);
  }

  close(): void {
    this.resetSteps();
    modal.close(this.overlay);
  }

  get element(): HTMLElement {
    return this.overlay;
  }
}
