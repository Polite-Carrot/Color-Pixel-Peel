import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.politecarrot.colorpixelpeel',
  appName: 'Color Pixel Peel',
  // Vite's build output; `cap sync` copies this into the native shells.
  webDir: 'dist',
  // Black, to match the Polite Carrot startup lockup the page opens on —
  // so the native launch and the lockup are one continuous screen rather
  // than a flash of sky in between.
  backgroundColor: '#000000',
  ios: {
    // The layout handles safe areas itself via env(safe-area-inset-*).
    contentInset: 'never',
    backgroundColor: '#000000',
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
