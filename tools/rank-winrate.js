/* Hardness as "what fraction of deals of this picture are winnable at
 * Expert". Smoother and more meaningful than counting reseeds: a picture
 * whose every deal wins is easy however many tiles it has. */
import { PICTURE_COUNT, picture } from '/home/user/Color-Pixel-Peel/src/core/pictures.ts';
import { colorCounts, parsePicture } from '/home/user/Color-Pixel-Peel/src/core/picture.ts';
import { block } from '/home/user/Color-Pixel-Peel/src/core/blocks.ts';
import { createRng } from '/home/user/Color-Pixel-Peel/src/core/rng.ts';
import { playGreedily } from '/home/user/Color-Pixel-Peel/src/core/solve.ts';
import { SETTINGS, blocksFor } from '/home/user/Color-Pixel-Peel/src/core/generator.ts';

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

{
  const expert = SETTINGS[4], hard = SETTINGS[3];
  const rows = [];
  for (let p = 0; p < PICTURE_COUNT; p += 1) {
    const art = picture(p);
    const counts = colorCounts(parsePicture(art));
    const total = [...counts.values()].reduce((n, c) => n + c, 0);
    rows.push({
      name: art.name, tiles: total, colors: counts.size,
      dom: Math.max(...counts.values()) / total,
      e: winRate(art, expert), h: winRate(art, hard),
    });
  }
  rows.sort((a, b) => (b.e + b.h) - (a.e + a.h));
  const line = (r) => `${r.name.padEnd(12)} ${String(r.tiles).padStart(4)}t ${r.colors}c dom ${(r.dom*100).toFixed(0).padStart(3)}%  Expert ${(r.e*100).toFixed(0).padStart(3)}%  Hard ${(r.h*100).toFixed(0).padStart(3)}%`;
  console.log('EASIEST 10 (most deals winnable):');
  for (const r of rows.slice(0, 10)) console.log('  ' + line(r));
  console.log('\nHARDEST 10:');
  for (const r of rows.slice(-10)) console.log('  ' + line(r));
  const owl = rows.find((r) => r.name === 'Owl');
  console.log(`\nOwl: ${line(owl)}   rank ${rows.indexOf(owl) + 1} of ${rows.length} (1 = easiest)`);
}
