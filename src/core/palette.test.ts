import { describe, expect, it } from 'vitest';
import { MAX_COLORS, MIN_DISTANCE, PALETTE, distance, markInk, swatch } from './palette';
import { levelConfig } from './level';

describe('palette', () => {
  it('keeps every prefix mutually distinguishable', () => {
    // Early levels use only the first few entries, so it is not enough for
    // the palette as a whole to be legible — every prefix has to be.
    for (let n = 2; n <= MAX_COLORS; n++) {
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const d = distance(a, b);
          expect(
            d,
            `${swatch(a).name} and ${swatch(b).name} are ${d.toFixed(1)} apart in the first ${n}`,
          ).toBeGreaterThanOrEqual(MIN_DISTANCE);
        }
      }
    }
  });

  it('never deals the cyan/teal pair Color Match still has open', () => {
    // teal #0ec3c6 sits 103 from this palette's cyan, below the rule. It is
    // left out entirely, so no board here can pair them.
    expect(PALETTE.map((s) => s.hex)).not.toContain('#0ec3c6');
    expect(PALETTE.some((s) => s.name === 'teal')).toBe(false);
  });

  it('gives every color its own letter', () => {
    const marks = new Set(PALETTE.map((s) => s.mark));
    expect(marks.size).toBe(MAX_COLORS);
    // A shared initial would defeat the point of the letters, and the mark
    // is the name's own initial so the two can never drift apart.
    for (const s of PALETTE) {
      expect(s.mark).toHaveLength(1);
      expect(s.mark).toBe((s.name[0] as string).toUpperCase());
    }
  });

  it('uses US spelling in the names players read', () => {
    for (const s of PALETTE) expect(s.name).not.toMatch(/colour|grey/);
  });

  it('covers the deepest palette the level curve can ask for', () => {
    const deepest = levelConfig(500).colors;
    expect(MAX_COLORS).toBeGreaterThanOrEqual(deepest);
  });

  it('measures distance symmetrically, and zero against itself', () => {
    expect(distance(0, 0)).toBe(0);
    expect(distance(0, 3)).toBeCloseTo(distance(3, 0));
  });

  it('picks mark ink by luminance, so a letter always reads', () => {
    const yellow = PALETTE.findIndex((s) => s.name === 'yellow');
    const blue = PALETTE.findIndex((s) => s.name === 'blue');
    expect(markInk(yellow)).toContain('28, 20, 48'); // dark ink on a bright tile
    expect(markInk(blue)).toContain('255, 255, 255'); // light ink on a dark one
  });

  it('rejects an unknown color id', () => {
    expect(() => swatch(99)).toThrow();
    expect(() => swatch(-1)).toThrow();
  });
});
