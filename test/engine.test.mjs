// Regression tests for the Cargo Builder packing engine. The engine code is read straight from
// public/adeyiq/build.html (the page users run), so these tests check exactly what ships. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../public/adeyiq/build.html", import.meta.url), "utf8").replace(/\r/g, "");
function slice(from, to) {
  const s = html.indexOf(from), e = html.indexOf(to, s + from.length);
  assert.ok(s >= 0 && e > s, `engine marker not found: ${from}`);
  return html.slice(s, e);
}
const src =
  slice("const ULD={", "\n};") + "\n};\n" +
  slice("function bounds(prof,z)", "\nlet yaw=") +
  "\nthis.E={ULD,bounds,packItems,layerPack};";
const ctx = { Math, Map, Set, Array, Number, String, JSON };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const { ULD, bounds, packItems } = ctx.E;

// deterministic random numbers so failures can be reproduced
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); }
let nextId = 0;
const ship = (l, w, h, pcs, wt = pcs * 20) => ({ id: "s" + ++nextId, l, w, h, pcs, wt, shc: [] });

const TOL = 0.6;
function checkBuild(type, items) {
  const T = ULD[type];
  const total = items.reduce((n, i) => n + i.p, 0);
  const r = packItems(type, items, false);
  const boxes = r.boxes;
  assert.equal(boxes.length + r.notShown + r.notDrawn, total, `${type}: every piece is either placed or reported as not fitting`);
  for (const b of boxes) {
    assert.ok(b.y0 >= -TOL && b.y1 <= T.Dp + TOL, `${type}: box inside the base depth (${b.y0}..${b.y1} of ${T.Dp})`);
    assert.ok(b.z0 >= -TOL && b.z1 <= T.H + TOL, `${type}: box under the contour height (${b.z1} of ${T.H})`);
    for (const z of [b.z0, b.z1]) {
      const [lo, hi] = bounds(T.prof, Math.min(z, T.H));
      assert.ok(b.x0 >= lo - TOL && b.x1 <= hi + TOL, `${type}: box ${b.x0}..${b.x1} inside the contour ${lo}..${hi} at height ${z}`);
    }
    if (b.z0 > TOL) {
      let s = 0;
      for (const o of boxes)
        if (Math.abs(o.z1 - b.z0) < TOL)
          s += Math.max(0, Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0)) * Math.max(0, Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0));
      const area = (b.x1 - b.x0) * (b.y1 - b.y0);
      assert.ok(s >= 0.85 * area - 1, `${type}: box at height ${b.z0} rests on cargo (${Math.round((100 * s) / area)}% supported)`);
    }
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
      const clash = ov(a.x0, a.x1, b.x0, b.x1) > TOL && ov(a.y0, a.y1, b.y0, b.y1) > TOL && ov(a.z0, a.z1, b.z0, b.z1) > TOL;
      assert.ok(!clash, `${type}: boxes ${i} and ${j} overlap`);
    }
  return r;
}

test("bounds follows the contour (AKE slanted side, PMC lower-deck shoulders)", () => {
  assert.deepEqual([...bounds(ULD.AKE.prof, 100)], [0, 201]);
  const [lo] = bounds(ULD.AKE.prof, 32);
  assert.ok(lo > 0 && lo < 45, "AKE floor narrows on the slanted side");
  const top = bounds(ULD.PMCL.prof, 163);
  assert.deepEqual([...top], [18, 300]);
});

test("one box sits on the floor", () => {
  const r = checkBuild("AKE", [{ s: ship(60, 40, 40, 1), p: 1 }]);
  assert.equal(r.boxes.length, 1);
  assert.equal(r.boxes[0].z0, 0);
});

test("a piece taller than the contour is reported, never placed through the roof", () => {
  const r = checkBuild("AKH", [{ s: ship(200, 160, 50, 1), p: 1 }]);
  assert.equal(r.boxes.length, 0);
  assert.equal(r.notShown, 1);
});

for (const type of ["AKE", "AKH", "PMCL", "PMC6", "PAGN", "PMC7", "PGA"]) {
  test(`${type}: random mixed cargo stays inside the contour, supported and without overlaps`, () => {
    const R = rng(type.length * 7919 + 17);
    for (let round = 0; round < 6; round++) {
      const items = Array.from({ length: 3 + Math.floor(R() * 5) }, () => {
        const s = ship(20 + Math.round(R() * 100), 20 + Math.round(R() * 80), 15 + Math.round(R() * 70), 1 + Math.floor(R() * 12));
        return { s, p: s.pcs };
      });
      checkBuild(type, items);
    }
  });
}

test("big builds (over 160 pieces) use layer packing and keep the same rules", () => {
  const items = [{ s: ship(40, 30, 30, 120), p: 120 }, { s: ship(50, 40, 25, 90), p: 90 }];
  const r = checkBuild("PMC7", items);
  assert.ok(r.boxes.length > 160, `placed ${r.boxes.length} pieces`);
  assert.equal(r.notDrawn, 0);
});

test("packing density of a full AKE does not get worse", () => {
  const r = checkBuild("AKE", [{ s: ship(50, 40, 40, 60), p: 60 }]);
  // Baseline, not an ideal: the slanted AKE floor allows roughly 45 of these boxes by hand; the engine places 36 today.
  assert.ok(r.boxes.length >= 36, `placed ${r.boxes.length} of 60 (baseline 36)`);
});
