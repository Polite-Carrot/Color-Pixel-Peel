import { describe, expect, it } from 'vitest';
import { MAX_COLORS, MIN_DISTANCE, PALETTE, RED, TAN, distance, markInk, swatch } from './palette';

describe('palette', () => {
  it('names a distance rule for pictures to be checked against', () => {
    // The rule is enforced per picture, not across the palette: red and
    // tan sit 142 apart and both are worth keeping. levels.test.ts is
    // where it bites.
    expect(MIN_DISTANCE).toBe(150);
    expect(distance(RED, TAN)).toBeLessThan(MIN_DISTANCE);
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
