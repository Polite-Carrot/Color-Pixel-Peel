/* sync-web.js — assemble www/ for Capacitor.
 *
 * Capacitor copies one folder (`webDir`) into the native projects, and
 * this game lives at the repository root next to package.json and
 * node_modules. Rather than move the game, this copies just the files the
 * page actually loads into a clean www/.
 *
 * The list comes from the <script> and <link> tags in index.html rather
 * than from a second copy kept here, so a new module cannot silently miss
 * the native build. Same trick as Color Match & Merge's sync-web.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'www');

/* Referenced from markup rather than from a <script> or <link>, so
   nothing below would otherwise pick them up. */
const EXTRA = ['assets/polite-carrot-logo.svg', 'assets/polite-carrot-name.svg'];

function referencedFiles(html) {
  const found = new Set();
  const pattern = /(?:src|href)\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const ref = match[1];
    // Only local, relative references are ours to copy.
    if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('/') || ref.startsWith('#')) continue;
    found.add(ref.replace(/^\.\//, '').split(/[?#]/)[0]);
  }
  return [...found];
}

function copy(rel) {
  const from = path.join(ROOT, rel);
  if (!fs.existsSync(from)) {
    throw new Error(`sync-web: index.html references ${rel}, which does not exist. Run the build first.`);
  }
  const to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return rel;
}

function main() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const files = ['index.html', ...referencedFiles(html), ...EXTRA];
  const copied = [...new Set(files)].map(copy);

  console.log(`sync-web: ${copied.length} files into www/`);
  for (const rel of copied.sort()) console.log(`  ${rel}`);
}

main();
