/**
 * Progress persistence. Every access is guarded: localStorage throws in
 * private-mode webviews and can be wiped at any time, and none of this
 * data is worth failing a launch over.
 */
export interface Progress {
  /** Highest level the player has unlocked (1-based). */
  unlockedLevel: number;
  bestScore: number;
  /** Colorblind symbol overlay preference. */
  symbols: boolean;
}

const KEY = 'color-pixel-peel:progress:v1';

export const DEFAULT_PROGRESS: Progress = {
  unlockedLevel: 1,
  bestScore: 0,
  symbols: false,
};

function coerce(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_PROGRESS };
  const o = raw as Record<string, unknown>;
  const level = typeof o.unlockedLevel === 'number' && Number.isFinite(o.unlockedLevel) ? o.unlockedLevel : 1;
  const best = typeof o.bestScore === 'number' && Number.isFinite(o.bestScore) ? o.bestScore : 0;
  return {
    unlockedLevel: Math.max(1, Math.trunc(level)),
    bestScore: Math.max(0, Math.trunc(best)),
    symbols: o.symbols === true,
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    return coerce(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable or full — progress is a convenience, not a
    // requirement, so play continues without it.
  }
}
