/* Hardness as "what fraction of deals of this picture are winnable at
 * Expert". Smoother and more meaningful than counting reseeds: a picture
 * whose every deal wins is easy however many tiles it has. */

import { colorCounts, parsePicture } from '../src/core/picture.ts';
import { block } from '../src/core/blocks.ts';
import { createRng } from '../src/core/rng.ts';
import { playGreedily } from '../src/core/solve.ts';
import { SETTINGS, blocksFor } from '../src/core/generator.ts';

export function cut(total, pieces, rng) {
  const n = Math.max(1, Math.min(pieces, total));
  const base = Math.floor(total / n);
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(base + (i < total % n ? 1 : 0));
  const swing = Math.max(1, Math.floor(base / 3));
  for (let i = 0; i + 1 < n; i += 2) {
    const move = rng.int(swing + 1);
    if (out[i] - move < 1) continue;
    out[i] -= move; out[i + 1] += move;
  }
  return out;
}

export function winRate(art, rules, deals = 40) {
  const counts = colorCounts(parsePicture(art));
  const total = [...counts.values()].reduce((n, c) => n + c, 0);
  const want = blocksFor(rules, total);
  let won = 0;
  for (let d = 0; d < deals; d += 1) {
    const rng = createRng(1_000_003 + d * 31);
    const blocks = [];
    for (const color of [...counts.keys()].sort((a, b) => a - b)) {
      const c = counts.get(color);
      for (const size of cut(c, Math.max(1, Math.round((want * c) / total)), rng)) {
        blocks.push(block(color, size));
      }
    }
    if (playGreedily({ name: art.name, brief: '', picture: art, slots: rules.slots, columns: rules.columns, seed: d, blocks }).won) won += 1;
  }
  return won / deals;
}

/* Measuring only — importing this must not run the whole library, which
   it used to: rank-pictures.js imports winRate and the survey below then
   ran a second time on every invocation. */
