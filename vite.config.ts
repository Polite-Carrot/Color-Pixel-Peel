import { defineConfig } from 'vite';

/**
 * The shipped artifact is the repository root: `index.html` next to
 * `fonts.css`, `assets/` and the built `app/`. That is so GitHub Pages
 * can serve the branch root directly, the way Color Match & Merge is
 * served — no build step between the repo and a working page.
 *
 * So Vite is used only to bundle `src/` into `app/`, and the HTML is
 * hand-written rather than generated. Nothing here processes
 * `index.html`, and nothing rewrites its tags.
 */
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'app',
    // `app/` holds only what this build writes, so emptying it is safe —
    // unlike the repo root, which it must never touch.
    emptyOutDir: true,
    // The committed bundle is read by people as a diff, so no sourcemap
    // and no hashed names: `app/app.js` is always the same path.
    sourcemap: false,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
        // One file rather than a bundle plus lazy chunks. A committed
        // artifact is easier to reason about as a single file, and the
        // only dynamic import here is Capacitor's web shim.
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
