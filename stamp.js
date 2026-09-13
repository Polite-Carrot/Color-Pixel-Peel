/* stamp.js — put the bundle's fingerprint in the URLs index.html asks for.
 *
 * The bundle has fixed filenames on purpose: app/app.js is one stable
 * path, so a change to it reads as a diff rather than as a new file
 * appearing and an old one vanishing. The cost is that the URL never
 * changes, so a browser that has the old one cached goes on serving it —
 * which is exactly what happened: Pages had published the new build and
 * phones were still running the previous one.
 *
 * So the content's hash goes in a query string. The path in git stays
 * stable, and the URL changes whenever the bytes do.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** Short but far past any chance of colliding by accident. */
const LENGTH = 10;

function fingerprint(files) {
  const hash = createHash('sha256');
  for (const rel of files) hash.update(fs.readFileSync(path.join(ROOT, rel)));
  return hash.digest('hex').slice(0, LENGTH);
}

function main() {
  const bundle = ['app/app.js', 'app/app.css'];
  for (const rel of bundle) {
    if (!fs.existsSync(path.join(ROOT, rel))) {
      throw new Error(`stamp: ${rel} is missing — run the build first`);
    }
  }

  const version = fingerprint(bundle);
  const page = path.join(ROOT, 'index.html');
  const before = fs.readFileSync(page, 'utf8');

  // Rewrites only the version on those two URLs; nothing else in the
  // hand-written page is touched.
  const after = before.replace(
    /(\.\/app\/app\.(?:js|css))(\?v=[A-Za-z0-9]+)?/g,
    (_match, file) => `${file}?v=${version}`,
  );

  if (!after.includes(`app.js?v=${version}`) || !after.includes(`app.css?v=${version}`)) {
    throw new Error('stamp: index.html does not reference the bundle as expected');
  }

  if (after !== before) {
    fs.writeFileSync(page, after);
    console.log(`stamp: index.html now asks for ?v=${version}`);
  } else {
    console.log(`stamp: already at ?v=${version}`);
  }
}

main();
