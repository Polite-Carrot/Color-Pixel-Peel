import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the bundle works when loaded from the native
  // Capacitor webview (capacitor://localhost / https://localhost) as
  // well as from a plain web host.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: true,
    port: 5173,
  },
});
