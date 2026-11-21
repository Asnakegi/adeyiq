/* AdeyIQ QR code encoder: runs in the browser, so a measurement link is never sent to an outside QR service.
   Byte mode, error correction level M, versions 1 to 10 (up to 213 bytes, far more than a link needs).
   Follows ISO/IEC 18004; structure after Project Nayuki's public-domain-style reference (MIT).
   Browser: window.AdeyQR.svg(text) → SVG markup. Node tests: module.exports. */
(function (root) {
  'use strict';
  // [total codewords, EC codewords per block, [[block count, data codewords per block], ...]] for level M
  var V = [null,
    [26, 10, [[1, 16]]], [44, 16, [[1, 28]]], [70, 26, [[1, 44]]], [100, 18, [[2, 32]]], [134, 24, [[2, 43]]],
    [172, 16, [[4, 27]]], [196, 18, [[4, 31]]], [242, 22, [[2, 38], [2, 39]]], [292, 22, [[3, 36], [2, 37]]], [346, 26, [[4, 43], [1, 44]]]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(s));
    return Array.from(unescape(encodeURIComponent(s)), function (c) { return c.charCodeAt(0); });
  }
  function gmul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsDivisor(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < deg; i++) { for (var j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= gmul(c, f); }); });
    return r;
  }
  function dataCap(v) { return V[v][2].reduce(function (s, b) { return s + b[0] * b[1]; }, 0); }

  function encode(text) {
    var bytes = utf8(String(text)), v, cc;
    for (v = 1; v <= 10; v++) { cc = v < 10 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCap(v) * 8) break; }
    if (v > 10) throw new Error('text too long for a QR code');
    // bit stream: byte mode, count, data, terminator, padding
    var bits = [], cap = dataCap(v) * 8;
    var put = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, cc); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var cw = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
    // split into blocks, add Reed-Solomon error correction, interleave
    var ec = V[v][1], div = rsDivisor(ec), blocks = [], k = 0;
    V[v][2].forEach(function (g) { for (var n = 0; n < g[0]; n++) { var d = cw.slice(k, k + g[1]); k += g[1]; blocks.push({ d: d, e: rsRemainder(d, div) }); } });
    var all = [], maxD = Math.max.apply(null, blocks.map(function (x) { return x.d.length; }));
    for (i = 0; i < maxD; i++) blocks.forEach(function (x) { if (i < x.d.length) all.push(x.d[i]); });
    for (i = 0; i < ec; i++) blocks.forEach(function (x) { all.push(x.e[i]); });
    if (all.length !== V[v][0]) throw new Error('internal: codeword count');

    var size = v * 4 + 17, mod = [], fn = [];
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    var set = function (x, y, dark) { mod[y][x] = !!dark; fn[y][x] = true; };
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = c[0] + dx, y = c[1] + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    });
    var al = ALIGN[v], na = al.length;
    for (i = 0; i < na; i++) for (j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++) set(al[i] + dx2, al[j] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    var drawFormat = function (mask) {
      var data = (0 << 3) | mask, rem = data; // level M = 00
      for (var t = 0; t < 10; t++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((data << 10) | rem) ^ 0x5412, bit = function (n) { return (f >>> n) & 1; };
      for (var q = 0; q <= 5; q++) set(8, q, bit(q));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(q));
      set(8, size - 8, 1); // dark module
    };
    drawFormat(0);
    if (v >= 7) {
      var r7 = v; for (i = 0; i < 12; i++) r7 = (r7 << 1) ^ ((r7 >>> 11) * 0x1F25);
      var vb = (v << 12) | r7;
      for (i = 0; i < 18; i++) { var bt = (vb >>> i) & 1, a = size - 11 + (i % 3), bb = Math.floor(i / 3); set(a, bb, bt); set(bb, a, bt); }
    }
    // data in the zigzag order, two columns at a time from the bottom right
    var bi = 0, total = all.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < total) { mod[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }
    var maskFn = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x) { return x % 3 === 0; },
      function (x, y) { return (x + y) % 3 === 0; }, function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return x * y % 2 + x * y % 3 === 0; }, function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }];
    var applyMask = function (m) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) { applyMask(m); drawFormat(m); var p = penalty(mod, size); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size: size, version: v, mask: best, get: function (x, y) { return x >= 0 && y >= 0 && x < size && y < size && mod[y][x]; }, rows: mod };
  }

  function penalty(mod, size) {
    var p = 0, x, y, dark = 0;
    var line = function (get) {
      var run = 1, s = 0, arr = [];
      for (var i = 0; i < size; i++) arr.push(get(i));
      for (i = 1; i <= size; i++) { if (i < size && arr[i] === arr[i - 1]) run++; else { if (run >= 5) s += 3 + run - 5; run = 1; } }
      var pat = [1, 0, 1, 1, 1, 0, 1];
      for (i = 0; i + 7 <= size; i++) {
        var hit = true; for (var k = 0; k < 7; k++) if (+arr[i + k] !== pat[k]) { hit = false; break; }
        if (!hit) continue;
        var before = true, after = true;
        for (k = 1; k <= 4; k++) { if (i - k >= 0 && arr[i - k]) before = false; if (i + 6 + k < size && arr[i + 6 + k]) after = false; }
        if (before || after) s += 40;
      }
      return s;
    };
    for (y = 0; y < size; y++) p += line(function (i) { return mod[y][i]; });
    for (x = 0; x < size; x++) p += line(function (i) { return mod[i][x]; });
    for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  }

  /* SVG with a 4-module quiet zone; dark modules drawn as one path (black on white, as scanners expect) */
  function svg(text, px) {
    var q = encode(text), n = q.size + 8, d = '';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.rows[y][x]) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z';
    var s = px ? ' width="' + px + '" height="' + px + '"' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '"' + s + ' shape-rendering="crispEdges" role="img" aria-label="QR code of the measurement link">' +
      '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  var api = { encode: encode, svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AdeyQR = api;
})(this);
