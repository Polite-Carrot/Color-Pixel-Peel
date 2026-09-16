/* check-levels.js — deal the whole campaign and report what it measures.
 *
 * The curve is a claim until something plays it. This deals every level,
 * has the greedy solver finish it, and prints what that took: how many
 * plays, how full the panel got, how often a play had to strand a block
 * whose colour was sealed inside the picture. Exits 1 if any level cannot
 * be finished, which is the one result that must never ship. */
import { LEVEL_COUNT, levelDef, levelSummary } from '../src/core/levels.ts';
import { SETTINGS } from '../src/core/generator.ts';
import { playGreedily } from '../src/core/solve.ts';
import { boardFromPicture, isAccessible } from '../src/core/board.ts';

function survey(def) {
  const board = boardFromPicture(def.picture);
  const showing = new Set();
  const all = new Set();
  for (let i = 0; i < board.tiles.length; i += 1) {
    const tile = board.tiles[i];
    if (tile === null) continue;
    all.add(tile);
    if (isAccessible(board, i)) showing.add(tile);
  }
  const tiles = board.tiles.filter((t) => t !== null).length;
  return { tiles, colors: all.size, sealed: all.size - showing.size };
}

const rows = [];
let failures = 0;

for (let index = 1; index <= LEVEL_COUNT; index += 1) {
  const summary = levelSummary(index);
  /* A level that cannot be dealt at all is a result, not a crash: the
     point of this tool is to find every one of them in a single pass. */
  let def;
  try {
    def = levelDef(index);
  } catch (err) {
    failures += 1;
    console.log(`${index} ${summary.name} (${summary.setting}): ${(err && err.message) || err}`);
    continue;
  }
  const run = playGreedily(def);
  const { tiles, colors, sealed } = survey(def);
  if (!run.won) failures += 1;
  rows.push({
    index,
    name: summary.name,
    setting: summary.setting,
    tiles,
    colors,
    sealed,
    blocks: def.blocks.length,
    columns: def.columns,
    slots: def.slots,
    plays: run.plays,
    peak: run.peakSlots,
    stranded: run.strandedPlays,
    won: run.won,
    left: run.tilesLeft,
  });
}

const pad = (v, n) => String(v).padStart(n);
const padEnd = (v, n) => String(v).padEnd(n);

/* Five hundred rows is more than anyone reads at once, so the table is
   opt-in and the aggregates below always print. */
const verbose = process.argv.includes('--all');

if (verbose) console.log(
  padEnd('#', 4) + padEnd('picture', 12) + padEnd('setting', 8) +
  pad('tiles', 6) + pad('col', 4) + pad('sealed', 7) + pad('blocks', 7) +
  pad('cols', 5) + pad('slots', 6) + pad('plays', 6) + pad('peak', 5) +
  pad('strand', 7) + '  won'
);
for (const r of verbose ? rows : []) {
  console.log(
    padEnd(r.index, 4) + padEnd(r.name, 12) + padEnd(r.setting, 8) +
    pad(r.tiles, 6) + pad(r.colors, 4) + pad(r.sealed, 7) + pad(r.blocks, 7) +
    pad(r.columns, 5) + pad(r.slots, 6) + pad(r.plays, 6) + pad(r.peak, 5) +
    pad(r.stranded, 7) + '  ' + (r.won ? 'yes' : 'NO (' + r.left + ' left)')
  );
}

console.log('');
console.log('per setting');
console.log(
  padEnd('setting', 9) + pad('levels', 7) + pad('slots', 6) + pad('cols', 5) +
  pad('blocks', 8) + pad('plays', 7) + pad('peak', 6) + pad('strand', 8)
);
for (const setting of SETTINGS) {
  const mine = rows.filter((r) => r.setting === setting.name);
  const mean = (pick) => (mine.reduce((n, r) => n + pick(r), 0) / mine.length).toFixed(1);
  const max = (pick) => Math.max(...mine.map(pick));
  console.log(
    padEnd(setting.name, 9) + pad(mine.length, 7) + pad(setting.slots, 6) +
    pad(setting.columns, 5) + pad(mean((r) => r.blocks), 8) +
    pad(mean((r) => r.plays), 7) + pad(max((r) => r.peak), 6) +
    pad(mean((r) => r.stranded), 8)
  );
}

console.log('');
console.log(`${LEVEL_COUNT} levels dealt, ${LEVEL_COUNT - failures} winnable, ${failures} not`);
const full = rows.filter((r) => r.peak >= r.slots).length;
console.log(`${full}/${LEVEL_COUNT} levels drive the panel to full`);
if (failures > 0) process.exit(1);
