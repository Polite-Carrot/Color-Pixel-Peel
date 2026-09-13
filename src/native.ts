import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Native-shell setup. Everything here is optional polish, so each step
 * is individually guarded: a plugin missing from a given platform must
 * never stop the game from starting.
 */
export async function initNative(): Promise<void> {
  if (!isNative()) return;

  try {
    // The app draws its own dark background under the status bar.
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    // StatusBar is unavailable on some platforms/versions.
  }
}

/** Short tick for a successful peel. Region size scales the impact. */
export function peelFeedback(regionSize: number): void {
  const style = regionSize >= 6 ? ImpactStyle.Heavy : regionSize >= 3 ? ImpactStyle.Medium : ImpactStyle.Light;
  void Haptics.impact({ style }).catch(() => {
    // No haptic hardware, or unsupported browser — silently skip.
  });
}

/** Buzz for an illegal tap. */
export function rejectFeedback(): void {
  void Haptics.notification().catch(() => {});
}
