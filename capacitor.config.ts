import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.politecarrot.colorpixelpeel',
  appName: 'Color Pixel Peel',
  /* Assembled by sync-web.js, which copies just the files index.html
     loads. The game itself lives at the repository root, which cannot be
     handed to Capacitor as-is — it holds node_modules. */
  webDir: 'www',
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
