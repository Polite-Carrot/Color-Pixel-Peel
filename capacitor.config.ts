import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.politecarrot.colorpixelpeel',
  appName: 'Color Pixel Peel',
  // Vite's build output; `cap sync` copies this into the native shells.
  webDir: 'dist',
  // Matches --bg in style.css so there is no white flash on launch and
  // no light band behind the safe areas.
  backgroundColor: '#0d1017',
  ios: {
    // The layout handles safe areas itself via env(safe-area-inset-*).
    contentInset: 'never',
    backgroundColor: '#0d1017',
  },
  android: {
    backgroundColor: '#0d1017',
  },
};

export default config;
