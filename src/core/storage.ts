/**
 * Somewhere to keep progress that survives closing the game.
 *
 * localStorage is the right place for it — progress belongs to the person
 * playing, not to everyone who opens the page — but it is not guaranteed
 * to be there. A private window, an embedded view, or a browser set to
 * block site data can each refuse it: sometimes by throwing, and
 * sometimes, worse, by accepting a write and keeping nothing.
 *
 * So the backing store is chosen by testing it rather than by assuming:
 * write a probe, read it back, and only trust it if the value survives the
 * round trip. Whatever is chosen, the game says so on screen rather than
 * quietly losing someone's progress. This mirrors `js/store.js` in Color
 * Match & Merge.
 */

/** 'kept' survives closing the game; 'this-visit' lasts until the tab
 *  closes; 'not-kept' means nothing is being stored at all. */
export type StoreKind = 'kept' | 'this-visit' | 'not-kept';

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PROBE = 'pixelpeel.probe';

function survivesRoundTrip(store: KeyValueStore | null | undefined): boolean {
  if (!store) return false;
  try {
    const stamp = String(Date.now());
    store.setItem(PROBE, stamp);
    const back = store.getItem(PROBE) === stamp;
    store.removeItem(PROBE);
    return back;
  } catch {
    return false; // blocked outright
  }
}

/** Last resort. Keeps the game working for one sitting, and is honest
 *  that nothing will be there next time. */
function inMemory(): KeyValueStore {
  const held = new Map<string, string>();
  return {
    getItem: (k) => (held.has(k) ? (held.get(k) as string) : null),
    setItem: (k, v) => void held.set(k, String(v)),
    removeItem: (k) => void held.delete(k),
  };
}

function choose(): { store: KeyValueStore; kind: StoreKind } {
  try {
    if (survivesRoundTrip(globalThis.localStorage)) {
      return { store: globalThis.localStorage, kind: 'kept' };
    }
  } catch {
    // Touching it can throw before it is even used.
  }
  try {
    if (survivesRoundTrip(globalThis.sessionStorage)) {
      return { store: globalThis.sessionStorage, kind: 'this-visit' };
    }
  } catch {
    // Ditto.
  }
  return { store: inMemory(), kind: 'not-kept' };
}

const chosen = choose();

export const storeKind: StoreKind = chosen.kind;
export const survivesClosing = chosen.kind === 'kept';

/** What to tell the player when progress is not being kept properly. */
export function storeWarning(): string | null {
  if (chosen.kind === 'kept') return null;
  return chosen.kind === 'this-visit'
    ? 'Progress lasts until you close this tab — this browser will not store it for longer.'
    : 'Progress is not being saved. This browser is blocking site data.';
}

export interface Progress {
  /** Highest level the player has unlocked (1-based). */
  unlockedLevel: number;
  bestScore: number;
  /** Color Blind Assist: a letter on every color. */
  assist: boolean;
}

/* Progress and the assist preference are kept under separate keys. A
   preference is not something earned, and writing it must never put
   anything near the record of progress. */
const PROGRESS_KEY = 'pixelpeel.progress.v1';
const PREFS_KEY = 'pixelpeel.prefs.v1';

export const DEFAULT_PROGRESS: Progress = {
  unlockedLevel: 1,
  bestScore: 0,
  assist: false,
};

function readJson(key: string): unknown {
  try {
    const raw = chosen.store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    chosen.store.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do: the store already reported what it can manage.
  }
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

export function loadProgress(): Progress {
  const raw = readJson(PROGRESS_KEY);
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const prefs = (readJson(PREFS_KEY) ?? {}) as Record<string, unknown>;
  return {
    unlockedLevel: Math.max(1, positiveInt(o.unlockedLevel, 1)),
    bestScore: positiveInt(o.bestScore, 0),
    assist: prefs.assist === true,
  };
}

export function saveProgress(progress: Progress): void {
  writeJson(PROGRESS_KEY, {
    unlockedLevel: progress.unlockedLevel,
    bestScore: progress.bestScore,
  });
}

export function savePrefs(progress: Progress): void {
  writeJson(PREFS_KEY, { assist: progress.assist });
}
