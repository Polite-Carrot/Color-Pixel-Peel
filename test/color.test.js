'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

require('../js/color.js');
const Color = globalThis.Color;

test('parse: long and short hex, with or without the hash', () => {
  assert.deepStrictEqual(Color.parse('#e8544f'), { r: 232, g: 84, b: 79 });
  assert.deepStrictEqual(Color.parse('e8544f'), { r: 232, g: 84, b: 79 });
  assert.deepStrictEqual(Color.parse('#fff'), { r: 255, g: 255, b: 255 });
});

test('parse: refuses anything that is not a hex colour', () => {
  assert.throws(() => Color.parse('rebeccapurple'), /not a hex colour/);
  assert.throws(() => Color.parse('#ff'), /not a hex colour/);
});

test('distance: nothing is far from itself, and opposites are far apart', () => {
  assert.strictEqual(Color.distance('#123456', '#123456'), 0);
  assert.ok(Color.distance('#000000', '#ffffff') > 700);
});

test('distance: is symmetric', () => {
  assert.strictEqual(Color.distance('#e8544f', '#3f7d55'), Color.distance('#3f7d55', '#e8544f'));
});

test('tooClose: names the offending pair rather than just refusing', () => {
  /* The cyan/teal clash the merge game still carries, which is exactly the
     kind of pair a level must never ask somebody to tell apart. */
  const clash = Color.tooClose(['#22c8ff', '#0ec3c6']);
  assert.strictEqual(clash.length, 1);
  assert.deepStrictEqual([clash[0].a, clash[0].b], [0, 1]);
  assert.ok(clash[0].distance < Color.MIN_DISTANCE);
});

test('tooClose: a well-spread palette reports nothing', () => {
  assert.deepStrictEqual(Color.tooClose(['#1b1b1f', '#e8544f', '#f2f2f0', '#3f7d55']), []);
});

test('ink: dark on light, light on dark', () => {
  assert.match(Color.ink('#ffffff'), /^rgba\(28/);
  assert.match(Color.ink('#000000'), /^rgba\(255/);
});

test('shade: keeps the hue and darkens', () => {
  const dark = Color.parse(Color.shade('#e8544f'));
  const light = Color.parse('#e8544f');
  assert.ok(dark.r < light.r && dark.g < light.g && dark.b < light.b);
  assert.ok(dark.r > dark.g && dark.r > dark.b, 'still a red');
});
