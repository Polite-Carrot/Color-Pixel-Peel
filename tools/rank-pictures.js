/* Rank the library by how often its deals are actually winnable, averaged
   over the three tightest settings. Writes the order out for the emitter. */
import { writeFileSync } from 'node:fs';
import { PICTURE_COUNT, picture } from '/home/user/Color-Pixel-Peel/src/core/pictures.ts';
import { colorCounts, parsePicture } from '/home/user/Color-Pixel-Peel/src/core/picture.ts';
import { SETTINGS } from '/home/user/Color-Pixel-Peel/src/core/generator.ts';
import { winRate } from './rank-winrate.js';

const rows = [];
for (let p = 0; p < PICTURE_COUNT; p += 1) {
  const art = picture(p);
  const counts = colorCounts(parsePicture(art));
  const tiles = [...counts.values()].reduce((n, c) => n + c, 0);
  const scores = [SETTINGS[2], SETTINGS[3], SETTINGS[4]].map((r) => winRate(art, r, 24));
  rows.push({ name: art.name, tiles, colors: counts.size, score: scores.reduce((a, b) => a + b, 0) / 3, scores });
}
/* Two rankings added together, because a run should open on something
   small and forgiving and close on something big and unforgiving --
   either measure alone gets one end wrong. Sorting by size put the
   903-tile Owl last though 98% of its deals were winnable; sorting by
   hardness alone puts a two-colour Panda at the finale. */
const byEasy = [...rows].sort((a, b) => b.score - a.score);
const bySmall = [...rows].sort((a, b) => a.tiles - b.tiles);
for (const r of rows) r.rank = byEasy.indexOf(r) + bySmall.indexOf(r);
rows.sort((a, b) => a.rank - b.rank || b.score - a.score);
writeFileSync('/tmp/claude-0/-home-user-Color-Pixel-Peel/15ace15b-f082-522b-adf5-1c4332d0ffac/scratchpad/order.txt', rows.map((r) => r.name).join('\n'));
const line = (i, r) => `${String(i + 1).padStart(3)} ${r.name.padEnd(12)} ${String(r.tiles).padStart(4)}t ${r.colors}c  winnable ${(r.score * 100).toFixed(0).padStart(3)}%  rank ${String(r.rank).padStart(3)}  [${r.scores.map((s) => (s * 100).toFixed(0)).join('/')}]`;
console.log('FIRST 8 (easiest):');
rows.slice(0, 8).forEach((r, i) => console.log('  ' + line(i, r)));
console.log('\nLAST 12 (hardest — these become the end of every run):');
rows.slice(-12).forEach((r, i) => console.log('  ' + line(rows.length - 12 + i, r)));
const owl = rows.findIndex((r) => r.name === 'Owl');
console.log(`\nOwl now sits at ${owl + 1} of 100 — ${line(owl, rows[owl]).trim()}`);
