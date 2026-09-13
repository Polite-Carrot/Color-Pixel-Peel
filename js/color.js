/* color.js — the little that has to be known about a colour.
 *
 * Pixel Peel has no fixed palette: every level carries its own, taken from
 * whatever picture it was drawn from. So unlike a game with ten named colours,
 * this file names nothing. It parses a hex string, says how far apart two
 * colours look, and picks ink that can be read on top of one.
 *
 * The distance measure is the same weighted one Color Match & Merge uses, and
 * for the same reason: it is not a colour science model, it is a cheap guard
 * against a level asking somebody to tell apart two colours that are, to the
 * eye, one colour. The importer refuses a quantisation that breaks it.
 *
 * Pure logic, no DOM. */
(function (global) {
  'use strict';

  /* Two colours closer than this are treated as the same colour for the
     purpose of a puzzle. Inherited from the merge game, where the palette is
     built to hold every pair at least this far apart. */
  var MIN_DISTANCE = 150;

  function parse(hex) {
    var h = String(hex).replace('#', '').trim();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('color: "' + hex + '" is not a hex colour');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function toHex(c) {
    function two(n) {
      var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }
    return '#' + two(c.r) + two(c.g) + two(c.b);
  }

  /* Rough perceptual gap. The weights approximate how much each channel
     contributes to a difference the eye actually notices — green most, red
     least — which is why this is not a plain euclidean distance. */
  function distance(a, b) {
    var x = typeof a === 'string' ? parse(a) : a;
    var y = typeof b === 'string' ? parse(b) : b;
    var dr = x.r - y.r, dg = x.g - y.g, db = x.b - y.b;
    return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
  }

  /* Every pair in a palette far enough apart to be told apart. Returns the
     offending pairs rather than a boolean, so a builder can say which two. */
  function tooClose(palette, minimum) {
    var limit = minimum || MIN_DISTANCE;
    var out = [];
    for (var i = 0; i < palette.length; i++) {
      for (var j = i + 1; j < palette.length; j++) {
        var d = distance(palette[i], palette[j]);
        if (d < limit) out.push({ a: i, b: j, distance: d });
      }
    }
    return out;
  }

  /* Dark or light ink for a label sitting on this colour. The threshold is
     the merge game's, so a number drawn on a cube here and a letter drawn on
     a band there flip at the same point. */
  function ink(hex) {
    var c = typeof hex === 'string' ? parse(hex) : hex;
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.58
      ? 'rgba(28, 20, 48, .55)'
      : 'rgba(255, 255, 255, .72)';
  }

  /* A darker edge of the same colour, for the cube's lip. Multiplying keeps
     the hue, which subtracting a constant does not. */
  function shade(hex, factor) {
    var c = typeof hex === 'string' ? parse(hex) : hex;
    var f = factor == null ? 0.72 : factor;
    return toHex({ r: c.r * f, g: c.g * f, b: c.b * f });
  }

  global.Color = {
    MIN_DISTANCE: MIN_DISTANCE,
    parse: parse,
    toHex: toHex,
    distance: distance,
    tooClose: tooClose,
    ink: ink,
    shade: shade
  };
})(typeof window !== 'undefined' ? window : globalThis);
