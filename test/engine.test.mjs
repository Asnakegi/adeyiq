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

// DG segregation rules (IATA DGR Table 9.3.A and 9.3.2.1.3), read from the same page
const dgSrc =
  slice("const DG=[", "\n") + "\n" +
  slice("const FOOD=", "\n  return null}") + "\n  return null}\n" +
  slice("function mk(o)", "}}\n") + "}}\n" +
  "this.D={conflict,mk};";
const dctx = { Math, String, Array, Number, Date, uid: () => "id" };
vm.createContext(dctx);
vm.runInContext(dgSrc, dctx);
const { conflict, mk } = dctx.D;
const dg = (cls, un = "", shc = "") => mk({ awb: "x", dg: cls, un, shc });

test("Table 9.3.A pairs are segregated, others are not", () => {
  for (const [a, b] of [["3", "5.1"], ["4.1", "5.1"], ["4.2", "5.1"], ["4.3", "8"], ["1", "2.2"]])
    assert.ok(conflict(dg(a), dg(b)) && conflict(dg(b), dg(a)), `${a} and ${b} must be kept apart`);
  for (const [a, b] of [["2.2", "5.1"], ["3", "8"], ["1.4S", "3"], ["6.1", "5.1"], ["9", "3"]])
    assert.equal(conflict(dg(a), dg(b)), null, `${a} and ${b} may travel together`);
});

test("UN3480 / UN3090 / UN3551 batteries are kept apart from 1, 2.1, 3, 4.1 and 5.1 (DGR 9.3.2.1.3)", () => {
  for (const un of ["UN3480", "UN 3090", "3551"])
    for (const c of ["1", "2.1", "3", "4.1", "5.1"]) {
      assert.ok(conflict(dg("9", un), dg(c)), `${un} with class ${c}`);
      assert.ok(conflict(dg(c), dg("9", un)), `class ${c} with ${un}`);
    }
  for (const c of ["1.4S", "2.2", "4.2", "4.3", "5.2", "8", "9"])
    assert.equal(conflict(dg("9", "UN3480"), dg(c)), null, `UN3480 with class ${c} needs no segregation`);
  assert.equal(conflict(dg("9", "UN3481"), dg("3")), null, "batteries in or with equipment are not in 9.3.2.1.3");
});

test("explosive divisions are read as class 1, except 1.4S", () => {
  assert.equal(dg("1.1D").dg, "1");
  assert.equal(dg("Class 1.3G").dg, "1");
  assert.equal(dg("1.4s").dg, "1.4S");
  assert.ok(conflict(dg("1.1"), dg("3")));
});

test("DG acceptance list (public/adeyiq/un-list.json) has the entries cargo teams check most", () => {
  const L = JSON.parse(fs.readFileSync(new URL("../public/adeyiq/un-list.json", import.meta.url), "utf8"));
  assert.ok(L.n > 2000 && Object.keys(L.d).length === L.n, `${L.n} UN numbers`);
  const first = (id) => L.d[id][0];
  for (const id of ["UN3480", "UN3090", "UN3551"]) assert.equal(first(id)[4], "Forbidden", `${id} is cargo aircraft only`);
  assert.equal(first("UN1845")[1], "9", "dry ice is class 9");
  assert.equal(first("UN1266")[1], "3", "perfumery products are class 3");
  assert.equal(first("UN0012")[1], "1.4S", "small-arms cartridges are 1.4S");
  assert.equal(dg(first("UN0012")[1]).dg, "1.4S");
  assert.equal(dg(first("UN0081")[1]).dg, "1", "blasting explosives map to class 1");
  for (const rows of Object.values(L.d)) for (const r of rows) assert.equal(r.length, 6);
});

test("packing density of a full AKE does not get worse", () => {
  const r = checkBuild("AKE", [{ s: ship(50, 40, 40, 60), p: 60 }]);
  // Baseline, not an ideal: the slanted AKE floor allows roughly 45 of these boxes by hand; the engine places 36 today.
  assert.ok(r.boxes.length >= 36, `placed ${r.boxes.length} of 60 (baseline 36)`);
});

test("subsidiary hazards are segregated like a primary class (e.g. UN2031: 8 with subsidiary 5.1)", () => {
  const nitric = mk({ awb: "x", dg: "8", sub: "5.1", un: "UN2031" });
  assert.deepEqual([...nitric.sub], ["5.1"]);
  assert.ok(conflict(nitric, dg("3")) && conflict(dg("3"), nitric), "8 (5.1) must be kept apart from class 3");
  assert.ok(conflict(nitric, dg("9", "UN3480")), "subsidiary 5.1 also keeps it away from UN3480 batteries");
  assert.equal(conflict(mk({ awb: "x", dg: "8", un: "UN2031" }), dg("3")), null, "without the subsidiary there is no 3/8 rule");
  assert.ok(conflict(mk({ awb: "x", dg: "3", sub: "6.1" }), mk({ awb: "y", shc: "EAT" })), "subsidiary 6.1 keeps it away from food");
});

test("subsidiary hazards are read from text and cleaned", () => {
  assert.deepEqual([...mk({ dg: "3", sub: "Class 6.1, 8" }).sub], ["6.1", "8"]);
  assert.deepEqual([...mk({ dg: "3", sub: "3; 1.1D" }).sub], ["1"], "same as primary dropped, explosive division read as 1");
  assert.deepEqual([...mk({ dg: "8", sub: "banana" }).sub], [], "unknown values dropped");
  assert.deepEqual([...mk({ dg: "", sub: "5.1" }).sub], [], "no subsidiary without a primary class");
  assert.deepEqual([...mk({ dg: "8", sub: ["5.1"] }).sub], ["5.1"], "kept when loaded back from saved cargo");
});

// ---------- manifest import: header matching, value parsers and the sample files in test/fixtures/manifests ----------
const imp = (() => {
  const src2 =
    slice("const DG=[", "\n") + "\n" + slice("const uid=", "\n") + "\n" +
    slice("/* ---------- reading files ---------- */", "/* manual placement") +
    slice("const LIM=", "\n\n/* ---------- saving") +
    "\nthis.I={rowsToShips,parseCSV,parseDims,num,parseWt,parsePcs,headerField};";
  const c = { Math, Set, Array, Number, String, JSON, RegExp, Object, Date, ships: [] };
  vm.createContext(c);
  vm.runInContext(src2, c);
  return c.I;
})();
const plain = (x) => JSON.parse(JSON.stringify(x));
const FIX = new URL("./fixtures/manifests/", import.meta.url);
const sheetjs = (() => {
  const c = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(new URL("../public/vendor/sheetjs/0.20.3/xlsx.full.min.js", import.meta.url), "utf8"), c);
  return c.XLSX;
})();
// read a sample file exactly like the page: CSV through parseCSV, Excel the way xlsx-worker.js reads it
function readFixture(name) {
  if (name.endsWith(".xlsx")) {
    const wb = sheetjs.read(fs.readFileSync(new URL(name, FIX)), { type: "buffer", cellFormula: false, cellHTML: false, cellStyles: false });
    return imp.rowsToShips(sheetjs.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" }));
  }
  return imp.rowsToShips(imp.parseCSV(fs.readFileSync(new URL(name, FIX), "utf8")));
}
const brief = (r) => r.list.map((s) => [s.awb, s.pcs, s.wt, `${s.l}x${s.w}x${s.h}`]);

test("header names are matched by their words, chargeable weight is never gross weight", () => {
  const k = (h) => imp.headerField(h).k;
  for (const h of ["Description of goods", "Commodity", "Nature & quantity of goods", "Goods"]) assert.equal(k(h), "nat", h);
  for (const h of ["No. of pcs", "Pkgs", "Pieces", "Qty"]) assert.equal(k(h), "pcs", h);
  for (const h of ["Gross Wt (kg)", "G.W.", "Weight", "Weight (lbs)"]) assert.equal(k(h), "wt", h);
  for (const h of ["Chargeable weight", "Vol. Wt", "Volumetric weight"]) assert.equal(k(h), "chg", h);
  for (const h of ["Dims (cm)", "Length/Width/Height", "LxWxH", "Dimensions"]) assert.equal(k(h), "dims", h);
  assert.equal(k("Volume (m3)"), "vol");
  assert.equal(k("Weight per piece"), "wpp");
  assert.deepEqual([k("L (cm)"), k("W"), k("Height")], ["l", "w", "h"]);
  assert.equal(imp.headerField("L (cm)").unit, "cm");
  assert.equal(imp.headerField("Dims in inches").unit, "in");
  assert.equal(imp.headerField("Weight (lbs)").wunit, "lb");
  for (const h of ["__proto__", "constructor", "prototype", "Destination", "Remarks"]) assert.equal(k(h), "", h);
});

test("dimensions in one cell, in every common notation and unit", () => {
  const one = (s) => { const d = imp.parseDims(s, ""); assert.ok(d && d.length === 1, s); return [d[0].l, d[0].w, d[0].h]; };
  for (const s of ["120x80x60", "120*80*60", "120 X 80 X 60", "120×80×60", "L120 W80 H60", "120/80/60", "120-80-60", "120 cm x 80 cm x 60 cm", "1200x800x600 mm", "1.2x0.8x0.6 m"])
    assert.deepEqual(one(s), [120, 80, 60], s);
  assert.deepEqual(one("47x31x24 in"), [119.4, 78.7, 61]);
  assert.equal(imp.parseDims("spare parts", ""), null);
  assert.equal(imp.parseDims("21/11/2026", ""), null, "a date is not a size");
  assert.equal(imp.parseDims("120/80/60", "", true), null, "strict mode (goods text, guessing) needs x or *");
});

test("several sizes per AWB, with pieces per size", () => {
  const d = (s) => plain(imp.parseDims(s, "")).map((x) => [x.p, x.l, x.w, x.h]);
  assert.deepEqual(d("2/120x80x60, 1/60x40x40"), [[2, 120, 80, 60], [1, 60, 40, 40]]);
  assert.deepEqual(d("2/120x80x60\n1/60x40x40"), [[2, 120, 80, 60], [1, 60, 40, 40]]);
  for (const s of ["2 @ 120x80x60", "120x80x60/2", "120x80x60x2", "2x120x80x60", "120x80x60 (2)", "2 pcs 120x80x60", "120x80x60 cm, 2 pcs"])
    assert.deepEqual(d(s), [[2, 120, 80, 60]], s);
});

test("weights and pieces with units and number formats", () => {
  assert.equal(imp.parseWt("1,234.5 kg"), 1234.5);
  assert.equal(imp.parseWt("1.234,5"), 1234.5);
  assert.equal(imp.parseWt("1 234,5"), 1234.5);
  assert.equal(imp.parseWt("450KG"), 450);
  assert.equal(imp.parseWt("990 lbs"), 449.1);
  assert.equal(imp.parseWt("220", "lb"), 99.8, "pounds from the header unit");
  assert.equal(imp.parseWt("2.5 t"), 2500);
  assert.equal(imp.parseWt(""), null);
  assert.deepEqual(["3 pcs", "3 PKG", "3/3", "3"].map(imp.parsePcs), [3, 3, 3, 3]);
});

test("the old simple layout still imports the same way", () => {
  const r = imp.rowsToShips([["AWB", "Goods", "Pieces", "Weight", "L", "W", "H", "DG", "UN"], ["071-12345675", "Paint", "2", "100", "50", "40", "30", "3", "1263"], [], ["", "No AWB box", "1", "10", "30", "30", "30", "", ""]]);
  assert.deepEqual(plain(brief(r)), [["071-12345675", 2, 100, "50x40x30"], ["No AWB 1", 1, 10, "30x30x30"]]);
  assert.equal(r.list[0].dg, "3");
  assert.equal(r.list[0].un, "UN1263");
  const p = imp.rowsToShips([["AWB", "Goods", "Pieces", "Weight per piece", "L", "W", "H"], ["071-1", "Box", "4", "25", "50", "40", "30"]]);
  assert.equal(p.list[0].wt, 100, "weight per piece x pieces");
  const e = imp.rowsToShips([["AWB", "Goods", "Pieces", "Weight", "L", "W", "H"], ["071-1", "Box", "999999", "10", "50", "40", "30"], ["071-2", "Box", "1", "", "50", "40", "30"]]);
  assert.equal(e.list.length, 0);
  assert.equal(e.errs.length, 2);
  assert.match(e.errs[1], /line 3: no weight/);
});

test("sample: title rows, semicolons, 1.234,5 weights, chargeable column, total line", () => {
  const r = readFixture("title-rows-semicolon.csv");
  assert.equal(r.info.hdr, 3, "header on row 4");
  assert.deepEqual(plain(brief(r)), [
    ["071-10000011", 4, 1234.5, "120x80x60"], ["071-10000022", 2, 450, "120x80x60"], ["071-10000033", 1, 86, "100x50x40"],
    ["071-10000044", 3, 300, "120x80x60"], ["071-10000055", 2, 95.5, "60x40x40"], ["071-10000066", 1, 40, "80x60x50"],
  ]);
  assert.equal(r.info.cols.find((c) => c.k === "wt").label, "Gross Wt (kg)");
  assert.ok(r.info.ignored.some((x) => x.label === "Chargeable weight"));
  assert.equal(r.info.skip["total line"], 1);
  assert.equal(r.errs.length, 0);
  assert.deepEqual(plain(r.list[3].shc), ["HEA"]);
});

test("sample: several sizes in one cell split into lines, weight shared by volume", () => {
  const r = readFixture("multi-dims.csv");
  assert.deepEqual(plain(brief(r)), [
    ["071-20000011", 2, 553.8, "120x80x60"], ["071-20000011", 1, 46.2, "60x40x40"],
    ["071-20000022", 2, 449.1, "120x80x60"],
    ["071-20000033", 3, 947, "100x80x50"], ["071-20000033", 2, 303, "80x60x40"],
    ["071-20000044", 3, 120, "80x50x40"],
  ]);
  const w = (awb) => Math.round(r.list.filter((s) => s.awb === awb).reduce((a, s) => a + s.wt, 0) * 10) / 10;
  assert.equal(w("071-20000011"), 600, "the split keeps the AWB weight");
  assert.equal(w("071-20000033"), 1250);
  assert.ok(r.info.ignored.some((x) => /Volume/.test(x.label)));
  assert.equal(r.info.split, 2);
});

test("sample: no header row, columns guessed from content", () => {
  const r = readFixture("no-header.csv");
  assert.equal(r.info.hdr, -1);
  assert.deepEqual(plain(r.info.guessed).sort(), ["awb", "dims", "nat", "pcs", "wt"]);
  assert.deepEqual(plain(brief(r)), [["071-30000011", 10, 250, "100x50x40"], ["071-30000022", 2, 40, "60x40x40"], ["071-30000033", 1, 800, "200x120x100"]]);
  assert.equal(r.list[0].nat, "Fresh flowers");
});

test("sample: tabs, L/W/H columns, weight per piece, repeated header", () => {
  const r = readFixture("lwh-tabs.tsv");
  assert.deepEqual(plain(brief(r)), [["071-40000011", 5, 500, "120x80x60"], ["071-40000022", 4, 100, "60x40x40"], ["071-40000033", 2, 180, "100x80x80"]]);
  assert.equal(r.info.skip["repeated header row"], 1);
  assert.equal(r.list[2].un, "UN1263");
});

test("sample (Excel): two-row header, merged AWB cells, empty column and rows", () => {
  const r = readFixture("merged-awb.xlsx");
  assert.equal(r.info.hdr, 3);
  assert.deepEqual(plain(brief(r)), [
    ["071-50000011", 3, 810, "120x80x60"], ["071-50000011", 2, 90, "60x40x40"],
    ["071-50000022", 1, 250, "150x100x90"],
    ["071-50000033", 4, 400, "100x60x50"], ["071-50000033", 4, 200, "50x40x30"],
  ]);
  assert.ok(r.list.every((s) => s.nat), "goods filled down from the merged cell");
  assert.equal(r.info.skip["total line"], 1);
});

test("sample (Excel): inches and pounds converted", () => {
  const r = readFixture("inches-lbs.xlsx");
  assert.deepEqual(plain(brief(r)), [["071-60000011", 2, 499, "119.4x78.7x61"], ["071-60000022", 1, 99.8, "119.4x78.7x61"], ["071-60000033", 3, 149.7, "61x50.8x50.8"]]);
});

test("sizes in plain millimetres are spotted from the column, and a file with no usable columns says so", () => {
  const r = imp.rowsToShips([["AWB", "Pcs", "Weight", "Dims"], ["071-1", "1", "100", "1200x800x600"], ["071-2", "1", "100", "1000x500x400"]]);
  assert.deepEqual(plain(brief(r)).map((x) => x[3]), ["120x80x60", "100x50x40"]);
  assert.ok(r.notes.some((n) => /millimetres/.test(n)));
  const bad = imp.rowsToShips([["Shipper", "Consignee"], ["Sample Co", "Other Co"]]);
  assert.equal(bad.list.length, 0);
  assert.match(bad.errs[0], /no weight or size columns/);
});

test("sample: charter piece list, a Piece ID column is a label and never a piece count", () => {
  const r = readFixture("piece-list.csv");
  assert.equal(r.info.hdr, 7, "the totals block above is not taken as the header");
  assert.deepEqual(plain(brief(r)), [["PC-001", 1, 517, "105x78x62"], ["PC-002", 1, 654, "106x79x79"], ["PC-003", 1, 729, "107x80x96"]]);
  assert.ok(r.notes.some((n) => /Piece ID/.test(n)));
  for (const h of ["Piece ID", "Pcs no.", "Item code", "Ref"]) assert.equal(imp.headerField(h).k, "ref", h);
  for (const h of ["No. of pcs", "Number of pieces"]) assert.equal(imp.headerField(h).k, "pcs", h);
  assert.equal(imp.parsePcs("PC-002"), null);
});

test("the downloadable cargo template: every column is understood, examples import, an empty template says what to do", () => {
  const wb = sheetjs.read(fs.readFileSync(new URL("../public/adeyiq/adeyiq-cargo-template.xlsx", import.meta.url)), { type: "buffer" });
  assert.equal(wb.SheetNames[0], "Cargo", "the sheet people fill is the first one (the only one imported)");
  const rows = (n) => sheetjs.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: "" });
  const head = rows("Cargo")[1];
  const want = ["awb", "nat", "pcs", "wt", "wpp", "l", "w", "h", "dg", "un", "sub", "shc", "excl", "ohg"];
  assert.deepEqual(plain(head.map((h) => imp.headerField(h).k)), want);
  const csvHead = imp.parseCSV(fs.readFileSync(new URL("../public/adeyiq/adeyiq-cargo-template.csv", import.meta.url), "utf8"))[0];
  assert.deepEqual(plain(csvHead), plain(head), "the CSV template has the same columns");
  const how = rows("How to fill").map((r) => r[0] + "|" + r[1]);
  for (const h of ["Weight kg (total) *", "Length cm *", "Width cm *", "Height cm *"]) assert.ok(how.some((x) => x.startsWith(h + "|Required")), h + " is marked required");
  const r = imp.rowsToShips(rows("Example"));
  assert.equal(r.errs.length, 0, r.errs.join("; "));
  assert.deepEqual(plain(brief(r)), [
    ["071-12345675", 4, 480, "120x80x60"], ["071-12345686", 10, 180, "40x30x30"], ["071-12345690", 2, 300, "100x80x90"],
    ["071-12345701", 30, 450, "100x50x40"], ["No AWB 1", 1, 2400, "300x200x150"],
  ]);
  assert.deepEqual([r.list[1].dg, r.list[1].un, r.list[4].excl, r.list[4].ohg, plain(r.list[3].shc)], ["3", "UN1263", true, 10, ["PER", "COL"]]);
  const empty = imp.rowsToShips(rows("Cargo"));
  assert.equal(empty.list.length, 0);
  assert.match(empty.errs[0], /no cargo lines under the header/);
});

// Load planning (buildUlds + planLoad), read from the same page. The page reads its settings from input fields,
// so $() returns the default value of each settings input; the aircraft is chosen through acNow().
const inputDefaults = {};
for (const m of html.matchAll(/<input id="(\w+)" type="number" value="([^"]*)"/g)) inputDefaults[m[1]] = m[2];
const planSrc =
  "var SEL,ships;\n" +
  slice("const DG=[", "\n") + "\n" + slice("const CAO_UN=", "\n") + "\n" +
  slice("const ULD={", "\n};") + "\n};\n" + slice("const AC=[", "\n];") + "\n];\n" +
  "const R=k=>Number($(k).value)||0;\nconst acNow=()=>AC.find(a=>a.id===SEL);\n" +
  slice("function fitsBase", "/* ---------- reading files") +
  slice("function mk(o)", "}}\n") + "}}\n" +
  slice("/* ---------- build ULDs", "/* ---------- 3D ULD") +
  slice("function bounds(prof,z)", "\nlet yaw=") +
  "\nthis.P={run(ac,list){SEL=ac;ships=list.map(mk);const b=buildUlds();return{b,p:planLoad(b)}},R};";
// localStorage stand-in: the user's own max payload per aircraft is kept in this browser only
const store = new Map();
const pctx = { Math, Map, Set, Array, Number, String, JSON, Object, performance, uid: (() => { let n = 0; return () => "p" + ++n; })(),
  $: (id) => ({ value: inputDefaults[id] ?? "" }), fmt: (n, d = 0) => Number(n || 0).toFixed(d), BULKN: null,
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) } };
vm.createContext(pctx);
vm.runInContext(planSrc + "\nthis.P.setPayOwn=setPayOwn;this.P.payMax=payMax;this.P.AC=AC;this.P.recommend=list=>recommend(list.map(mk));this.P.uSig=uSig;this.P.setHand=setHand;", pctx);
const { run: planRun, R: setting, setPayOwn, payMax, AC, recommend, uSig, setHand } = pctx.P;
const withPayload = (id, kg, fn) => { setPayOwn(id, kg); try { return fn(); } finally { setPayOwn(id, 0); } };
const onBoardKg = (b) => b.ulds.reduce((s, u) => s + (u.pos ? u.kg : 0), 0);

// heavy charter of low pieces (all under 150 cm): built as lower-deck-contour PMC pallets (163 cm), which the
// 777F main deck must take two abreast like main-deck pallets (27 positions), not one per row (14)
function lowCharter(seed, n = 300, extra = () => ({})) {
  const R = rng(seed), ri = (a, b) => Math.round(a + R() * (b - a));
  return Array.from({ length: n }, (_, i) => ({ id: `c${seed}-${i}`, awb: "", nat: "Goods " + i, pcs: 1, wt: ri(517, 817), l: ri(105, 204), w: ri(78, 122), h: ri(62, 150), ...extra(i) }));
}
function mainRows(b) {
  const rows = {};
  for (const u of b.ulds.filter((u) => u.blk && u.blk.c === "main")) (rows[u.pos[0]] = rows[u.pos[0]] || []).push(u);
  return rows;
}

test("every aircraft has a default max payload (placeholder figures)", () => {
  for (const ac of AC) assert.ok(ac.pay > 0 && payMax(ac) === ac.pay, `${ac.id}: ${ac.pay} kg`);
  assert.equal(AC.find((a) => a.id === "B777F").pay, 102000);
});

test("777F heavy charter (200 t): loads up to the 102 t default max payload, heaviest first, deck checks hold", () => {
  const list = lowCharter(7);
  const { b, p } = planRun("B777F", list);
  const kg = onBoardKg(b), off = b.offload.filter((o) => o.uld);
  assert.equal(p.pay, 102000);
  assert.ok(kg <= 102000 && kg > 95000, `on board ${Math.round(kg)} kg, at or under 102,000 kg and close to it`);
  assert.equal(Math.round(p.onBoard), Math.round(kg), "plan reports the weight on board");
  assert.ok(off.some((o) => /max payload 102000 kg of the Boeing 777 Freighter reached/.test(o.why)), "offloaded ULDs say the max payload was reached");
  assert.ok(off.filter((o) => /max payload/.test(o.why)).every((o) => o.uld.kg + kg > 102000), "every ULD offloaded for payload would have gone over it");
  for (const c of p.C) assert.ok(c.kg <= c.maxKg, `${c.name} within its ${c.maxKg} kg limit`);
  assert.ok(p.index >= setting("rIdxF") && p.index <= setting("rIdxA"), `balance index ${p.index.toFixed(1)} inside the limits`);
  assert.equal(p.issues.filter((i) => i.k === "bad").length, 0, "no limit exceeded");
  for (const [r, us] of Object.entries(mainRows(b))) assert.ok(us.length <= (r === "N" ? 1 : 2), `row ${r}: at most two pallets`);
});

test("a user max payload for the aircraft is respected (lower and higher than the default)", () => {
  const list = lowCharter(7);
  withPayload("B777F", 60000, () => {
    const { b, p } = planRun("B777F", list);
    assert.equal(p.pay, 60000);
    assert.ok(onBoardKg(b) <= 60000 && onBoardKg(b) > 55000, `on board ${Math.round(onBoardKg(b))} kg with a 60,000 kg user figure`);
  });
  assert.equal(planRun("B777F", lowCharter(7, 20)).p.pay, 102000, "back to the default after the user figure is removed");
  assert.equal(withPayload("B747-8F", 50000, () => planRun("B777F", lowCharter(7, 20)).p.pay), 102000, "a figure for another aircraft does not apply");
});

test("777F heavy charter of low pieces: lower-deck pallets fill all 27 main-deck positions two abreast", () => {
  const list = lowCharter(7);
  assert.ok(Math.abs(list.reduce((s, x) => s + x.wt, 0) - 200000) < 5000, "about 200 t booked");
  // a high user payload, so the slot model (not the payload) decides how many pallets go on the main deck
  const { b, p } = withPayload("B777F", 250000, () => planRun("B777F", list));
  const placed = b.ulds.filter((u) => u.pos), main = placed.filter((u) => u.blk.c === "main"), lower = placed.filter((u) => u.blk.c !== "main");
  assert.ok(main.every((u) => u.type === "PMCL"), "all built as lower-deck pallets");
  assert.equal(main.length, 27, `main deck takes 27 pallets (got ${main.length})`);
  assert.equal(lower.length, 10, `lower deck takes 10 pallets (got ${lower.length})`);
  const rows = mainRows(b);
  assert.equal(Object.keys(rows).length, 14, "14 main-deck rows");
  for (const [r, us] of Object.entries(rows)) {
    if (r === "N") assert.deepEqual(us.map((u) => u.pos), ["NP"], "the last 777F row is one centreline position");
    else assert.deepEqual(us.map((u) => u.pos).sort(), [r + "L", r + "R"], `row ${r} holds two pallets side by side`);
  }
  for (const c of p.C) assert.ok(c.kg <= c.maxKg, `${c.name} within its ${c.maxKg} kg limit (${Math.round(c.kg)} kg)`);
  assert.ok(p.index >= setting("rIdxF") && p.index <= setting("rIdxA"), `balance index ${p.index.toFixed(1)} inside the limits`);
  assert.equal(p.issues.filter((i) => i.k === "bad").length, 0, "no limit exceeded");
  assert.ok(b.ulds.filter((u) => !u.pos).every((u) => b.offload.some((o) => o.uld === u)), "every ULD without a position is reported as offloaded");
});

test("lower-deck pallets sharing a main-deck row keep DG segregation (class 3 never beside 5.1)", () => {
  const list = lowCharter(11, 200, (i) => (i % 4 === 0 ? { dg: "3", un: "UN1263" } : i % 4 === 2 ? { dg: "5.1", un: "UN1942" } : {}));
  const { b } = withPayload("B777F", 250000, () => planRun("B777F", list));
  const has =(u, cls) => u.items.some((i) => i.s.dg === cls), rows = mainRows(b);
  assert.ok(Object.values(rows).filter((us) => us.length === 2).length >= 10, "pallets are paired two abreast");
  for (const [r, us] of Object.entries(rows)) {
    assert.ok(us.length <= (r === "N" ? 1 : 2), `row ${r}: at most two pallets`);
    assert.ok(!(us.some((u) => has(u, "3")) && us.some((u) => has(u, "5.1"))), `row ${r}: flammable liquids and oxidizers are not side by side`);
  }
});

test("freighters are built on pallets only: no AKE containers on a 777F, AKE still used on a passenger aircraft", () => {
  const small = Array.from({ length: 40 }, (_, i) => ({ awb: "", nat: "Box " + i, pcs: 4, wt: 120, l: 60, w: 40, h: 40 }));
  assert.ok(planRun("B777F", small).b.ulds.every((u) => u.type !== "AKE"), "777F: no AKE");
  assert.ok(planRun("B787-9", small).b.ulds.some((u) => u.type === "AKE"), "787-9: AKE containers for small boxes");
});

test("aircraft recommendation: fewest flights, then the smallest aircraft that carries every piece", () => {
  const r = recommend(lowCharter(7));
  assert.equal(r.best.ac.id, "B777F", `200 t charter: ${r.best.ac.id}`);
  assert.equal(r.best.flights, 2, "200 t needs two 777F flights at 102 t");
  const tall = [{ awb: "", nat: "Machine", pcs: 1, wt: 3000, l: 200, w: 150, h: 220 }];
  assert.equal(recommend(tall).best.ac.g, "freighter", "a 220 cm piece needs a freighter main deck");
  const boxes = [{ awb: "", nat: "Boxes", pcs: 20, wt: 2000, l: 60, w: 40, h: 40 }];
  assert.notEqual(recommend(boxes).best.ac.g, "freighter", "2 t of small boxes fits a passenger aircraft");
  const cao = [{ awb: "", nat: "Batteries", pcs: 2, wt: 200, l: 60, w: 40, h: 40, dg: "9", un: "UN3480" }];
  assert.equal(recommend(cao).best.ac.g, "freighter", "cargo aircraft only goes on a freighter");
  assert.equal(withPayload("B777F", 50000, () => recommend(lowCharter(7)).best.ac.id), "B747-8F", "uses the user payload figure (777F at 50 t needs 4 flights, 747-8F 2)");
});

// changes by hand on the load (offload, load first, maximize to the contour), replayed after every rebuild
const withHand = (id, h, fn) => { setHand(id, { off: [], on: [], max: [], ...h }); try { return fn(); } finally { setHand(id, { off: [], on: [], max: [] }); } };
const pieces = (b) => b.ulds.reduce((s, u) => s + u.items.reduce((a, i) => a + i.p, 0), 0) + b.offload.filter((o) => !o.uld).reduce((s, o) => s + o.s.pcs, 0);

test("by hand: an offloaded ULD can be loaded (a lighter one makes room) and a loaded one offloaded, within payload and balance", () => {
  const list = lowCharter(7), base = planRun("B777F", list);
  const out = base.b.ulds.find((u) => !u.pos), inn = base.b.ulds.filter((u) => u.pos).sort((a, b) => a.kg - b.kg)[0];
  const on = withHand("B777F", { on: [uSig(out)] }, () => planRun("B777F", list));
  const got = on.b.ulds.find((u) => uSig(u) === uSig(out));
  assert.ok(got && got.pos, `${out.id} loaded by hand at ${got && got.pos}`);
  assert.ok(onBoardKg(on.b) <= 102000, "still within the max payload");
  assert.ok(on.p.index >= setting("rIdxF") && on.p.index <= setting("rIdxA"), "still in balance");
  const off = withHand("B777F", { off: [uSig(inn)] }, () => planRun("B777F", list));
  const gone = off.b.ulds.find((u) => uSig(u) === uSig(inn));
  assert.ok(gone && !gone.pos && off.b.offload.some((o) => o.uld === gone && o.why === "offloaded by hand"), `${inn.id} offloaded by hand`);
});

test("by hand: maximize fills a ULD from the not-loaded ULDs inside its contour, keeps every piece and DG rules", () => {
  const list = lowCharter(7), base = planRun("B777F", list);
  const t = base.b.ulds.filter((u) => u.pos).sort((a, b) => a.m3 / a.cap - b.m3 / b.cap)[0];
  const from = base.b.ulds.filter((u) => !u.pos).map(uSig);
  const mx = withHand("B777F", { max: [{ t: uSig(t), from }] }, () => planRun("B777F", list));
  const nt = mx.b.ulds.find((u) => u.id === t.id);
  assert.ok(nt.kg > t.kg && nt.maxed > 0, `${t.id}: ${Math.round(t.kg)} -> ${Math.round(nt.kg)} kg`);
  assert.ok(nt.kg <= nt.max + 1e-6 && nt.m3 <= nt.cap + 1e-6, "within ULD weight and usable volume");
  assert.equal(packItems(nt.type, nt.items, false).notShown, 0, "every piece fits the 3D contour");
  assert.equal(pieces(mx.b), pieces(base.b), "no piece lost or doubled");
  assert.ok(onBoardKg(mx.b) <= 102000, "still within the max payload");
  const dg = lowCharter(11, 120, (i) => (i % 2 ? { dg: "3", un: "UN1263" } : { dg: "5.1", un: "UN1942" })), bd = planRun("B777F", dg);
  const td = bd.b.ulds.find((u) => u.pos), md = withHand("B777F", { max: [{ t: uSig(td), from: bd.b.ulds.filter((u) => !u.pos).map(uSig) }] }, () => planRun("B777F", dg));
  const ntd = md.b.ulds.find((u) => u.id === td.id), cls = new Set(ntd.items.map((i) => i.s.dg));
  assert.ok(!(cls.has("3") && cls.has("5.1")), "maximize never mixes class 3 with 5.1");
});

// Measurement requests: compare planned vs measured and apply a result to the cargo list (pure functions of the page)
const msrCtx = { Math, Number, Object, Array, String };
vm.createContext(msrCtx);
vm.runInContext(slice("/* ---------- measurement requests: compare and apply", "/* ---------- measurement requests: planner side") + "\nthis.M={msrDiff,msrApply};", msrCtx);
const { msrDiff, msrApply } = msrCtx.M;
const req = (s, piece = "Piece 1 of " + s.pcs) => ({ shipId: s.id, awb: s.awb, piece, planned: { l: s.l || null, w: s.w || null, h: s.h || null } });
const M132 = { l: 132, w: 80, h: 78, method: { l: "tape", w: "tape", h: "photo" } };
// apply a result the way the page does: patch the line, then add the split-off piece
function applyTo(list, r, res, id) {
  const a = msrApply(list, r, res, id);
  if (!a.ok) return { list, a };
  const next = list.map((s) => (s.id === a.update.id ? { ...s, ...a.update.patch } : s));
  if (a.add) next.splice(next.findIndex((s) => s.id === a.update.id) + 1, 0, mk(a.add));
  return { list: next, a };
}
const totals = (list) => ({ pcs: list.reduce((n, s) => n + s.pcs, 0), kg: Math.round(list.reduce((n, s) => n + s.wt, 0) * 10) / 10 });

test("measure: planned 120×80×75 vs measured 132×80×78 gives +12, 0, +3 and flags the piece", () => {
  const d = plain(msrDiff({ l: 120, w: 80, h: 75 }, M132));
  assert.deepEqual(d.map((x) => x.d), [12, 0, 3]);
  assert.deepEqual(d.map((x) => x.big), [true, false, true]);
  const smaller = plain(msrDiff({ l: 120, w: 80, h: 75 }, { l: 118.5, w: 80, h: 70 }));
  assert.deepEqual(smaller.map((x) => [x.d, x.big]), [[-1.5, false], [0, false], [-5, false]], "smaller is not flagged");
});

test("measure: a missing planned dimension shows no difference and is not flagged", () => {
  const d = plain(msrDiff({ l: 120, w: null, h: 0 }, M132));
  assert.deepEqual(d.map((x) => [x.p, x.d, x.big]), [[120, 12, true], [null, null, false], [null, null, false]]);
  assert.deepEqual(plain(msrDiff(null, M132)).map((x) => x.d), [null, null, null]);
});

test("measure: applying to a multi-piece line splits off only the measured piece; pieces and weight totals unchanged", () => {
  const other = mk({ id: "o1", awb: "071-99999999", pcs: 2, wt: 50, l: 60, w: 40, h: 40 });
  const line = mk({ id: "s1", awb: "071-12345675", nat: "Machine parts", pcs: 3, wt: 300, l: 120, w: 80, h: 75, dg: "9", un: "UN3480", shc: "ELI", pin: "PMC:1" });
  const before = [other, line];
  const { list, a } = applyTo(before, req(line, "Piece 2 of 3"), M132, "new1");
  assert.ok(a.ok);
  assert.deepEqual(totals(list), totals(before), "same pieces and weight");
  const rest = list.find((s) => s.id === "s1"), piece = list.find((s) => s.id === "new1");
  assert.deepEqual([rest.pcs, rest.wt, rest.l, rest.w, rest.h, rest.mref], [2, 200, 120, 80, 75, ""], "the other pieces keep the planned size");
  assert.deepEqual([piece.pcs, piece.wt, piece.l, piece.w, piece.h, piece.mref], [1, 100, 132, 80, 78, "Piece 2 of 3"]);
  assert.deepEqual([piece.awb, piece.nat, piece.dg, piece.un, [...piece.shc], piece.pin], ["071-12345675", "Machine parts", "9", "UN3480", ["ELI"], "PMC:1"], "the piece keeps the line's AWB, goods, DG and placement");
  assert.deepEqual(list.find((s) => s.id === "o1"), other, "other lines untouched");
  const odd = applyTo([mk({ id: "s2", awb: "A", pcs: 3, wt: 100, l: 50, w: 50, h: 50 })], req(mk({ id: "s2", awb: "A", pcs: 3, l: 50, w: 50, h: 50 })), { l: 51, w: 50, h: 50 }, "n2").list;
  assert.deepEqual(odd.map((s) => s.wt), [66.7, 33.3], "uneven weights still add up to the line total");
});

test("measure: a one-piece line is updated in place; two requests on one line split one piece each", () => {
  const one = mk({ id: "s1", awb: "A", pcs: 1, wt: 80, l: 120, w: 80, h: 75 });
  const r1 = applyTo([one], req(one), M132, "x");
  assert.equal(r1.a.add, null);
  assert.deepEqual(r1.list.map((s) => [s.id, s.pcs, s.l, s.w, s.h, s.mref]), [["s1", 1, 132, 80, 78, "Piece 1 of 1"]]);
  const three = mk({ id: "s3", awb: "B", pcs: 3, wt: 90, l: 100, w: 100, h: 100 });
  const ra = req(three, "P1"), rb = req(three, "P2"), rc = req(three, "P3"), rd = req(three, "P4");
  let l = [three];
  l = applyTo(l, ra, { l: 101, w: 100, h: 100 }, "a").list;
  l = applyTo(l, rb, { l: 102, w: 100, h: 100 }, "b").list;
  l = applyTo(l, rc, { l: 103, w: 100, h: 100 }, "c").list;
  assert.deepEqual(l.map((s) => [s.pcs, s.l, s.mref]), [[1, 103, "P3"], [1, 102, "P2"], [1, 101, "P1"]]);
  assert.deepEqual(totals(l), { pcs: 3, kg: 90 });
  const r4 = msrApply(l, rd, { l: 104, w: 100, h: 100 }, "d");
  assert.ok(!r4.ok && /already has a measured size/.test(r4.why), "a fourth request for a three-piece line is blocked: " + r4.why);
});

test("measure: the update is blocked, with the reason, when the piece can't be matched reliably", () => {
  const line = mk({ id: "s1", awb: "071-12345675", pcs: 3, wt: 300, l: 120, w: 80, h: 75 });
  const r = req(line);
  const why = (list, rq = r) => {
    const a = msrApply(list, rq, M132, "n");
    assert.equal(a.ok, false);
    return a.why;
  };
  assert.match(why([]), /no longer in the list/);
  assert.match(why([{ ...line, awb: "071-00000000" }]), /now has AWB 071-00000000/);
  assert.match(why([{ ...line, h: 90 }]), /changed after the request/);
  assert.match(why([line], { ...r, shipId: null }), /not linked to a cargo line/);
  assert.equal(msrApply([line], r, { l: 132, w: 0, h: 78 }, "n").ok, false, "an incomplete result is never applied");
  // a line with missing planned sizes can still be matched (missing stays missing until the result is applied)
  const noDims = mk({ id: "s9", awb: "C", pcs: 2, wt: 40 });
  const ok = applyTo([noDims], req(noDims), M132, "m");
  assert.ok(ok.a.ok);
  assert.deepEqual(ok.list.map((s) => [s.pcs, s.l, s.w, s.h]), [[1, 0, 0, 0], [1, 132, 80, 78]]);
});

test("measure: after applying, the build-up reruns with every piece still accounted for", () => {
  const list = Array.from({ length: 6 }, (_, i) => ({ id: "b" + i, awb: "071-1000000" + i, pcs: 4, wt: 400, l: 120, w: 80, h: 75 }));
  const before = planRun("B787-9", list);
  const { list: after } = applyTo(list.map(mk), req(mk(list[2])), M132, "split");
  const run = planRun("B787-9", after);
  assert.equal(pieces(run.b), pieces(before.b), "no piece lost or doubled by the split");
  const where = run.b.ulds.find((u) => u.items.some((i) => i.s.id === "split")) || run.b.offload.find((o) => o.s && o.s.id === "split") || (run.b.bulk || []).find((h) => h.items.some((x) => x.id === "split" || (x._of && x._of.id === "split")));
  assert.ok(where, "the measured piece is placed in the rerun build-up, or reported as not loaded");
});

// QR codes for the measurement link are made in the browser (public/adeyiq/qr.js), never by an outside service
const qctx = { module: { exports: {} }, TextEncoder, Math, Array, String, Error };
vm.createContext(qctx);
vm.runInContext(fs.readFileSync(new URL("../public/adeyiq/qr.js", import.meta.url), "utf8"), qctx);
const QR = qctx.module.exports;

test("QR: structure of the code for a measurement link (finders, timing, format information for level M)", () => {
  const url = "https://adeyiq.vercel.app/measure#t=AbCdEfGhIjKlMnOpQrStUv&e=mh3k2a1";
  const q = QR.encode(url);
  assert.equal(q.size, q.version * 4 + 17);
  assert.ok(q.version >= 4 && q.version <= 6, "a link fits a small code, version " + q.version);
  for (const [x0, y0] of [[0, 0], [q.size - 7, 0], [0, q.size - 7]])
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        assert.equal(q.get(x0 + x, y0 + y), d !== 2, `finder pattern at ${x0},${y0}`);
      }
  for (let i = 8; i < q.size - 8; i++) assert.equal(q.get(i, 6), i % 2 === 0, "timing row");
  // format information around the top-left finder: BCH-valid, level M (00), and the same in the second copy
  const bits1 = [0, 1, 2, 3, 4, 5, 7, 8].map((y) => q.get(8, y)).concat([7, 5, 4, 3, 2, 1, 0].map((x) => q.get(x, 8)));
  const bits2 = Array.from({ length: 8 }, (_, i) => q.get(q.size - 1 - i, 8)).concat(Array.from({ length: 7 }, (_, i) => q.get(8, q.size - 7 + i)));
  const num = (b) => b.reduce((n, v, i) => n | ((v ? 1 : 0) << i), 0);
  assert.equal(num(bits1), num(bits2), "both copies of the format information agree");
  const f = num(bits1) ^ 0x5412;
  let rem = f >>> 10;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  assert.equal(f & 0x3ff, rem & 0x3ff, "format BCH code is valid");
  assert.equal(f >>> 13, 0, "error correction level M");
  assert.equal((f >>> 10) & 7, q.mask);
  assert.ok(q.get(8, q.size - 8), "dark module");
  assert.match(QR.svg(url), /^<svg [^>]*viewBox="0 0 (\d+) \1"[^>]*>.*<\/svg>$/);
  assert.throws(() => QR.encode("x".repeat(300)), /too long/);
  // cross-checked once with the jsQR decoder: links of 1 to 213 bytes (versions 1 to 10) decode back to the same text
});
