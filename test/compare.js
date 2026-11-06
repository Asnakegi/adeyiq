// Runs the v3 packBin and the v2 packBin on the same cargo and checks both
// with the same rules.  Usage:  node test/compare.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'adeyiq_cargo_optimizer_v3.html'), 'utf8');
const lines = html.split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('const ULD_DB={'));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function getSelectedULDs('));
const v3Code = lines.slice(start, end).join('\n').replace('function packBin(', 'function packBinV3(');
const v2Code = fs.readFileSync(path.join(root, 'packer-v2.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');

const ctx = { console, Math, Set, Map, document: {} };
vm.createContext(ctx);
vm.runInContext(v3Code + '\n' + v2Code + '\nthis.API={ULD_DB,packBinV3,packBin,checkBuild,buildStats};', ctx);
const { ULD_DB, packBinV3, packBin, checkBuild, buildStats } = ctx.API;

function explode(shipments) {
  const boxes = shipments.flatMap((s, si) => Array.from({ length: s.pcs }, (_, i) => ({ ...s, id: si, piece: i + 1 })));
  boxes.sort((a, b) => b.l * b.w * b.h - a.l * a.w * a.h);   // same as optimize()
  return boxes;
}

function run(name, code, shipments) {
  const spec = ULD_DB[code];
  const boxes = explode(shipments);
  const res = {};
  for (const [label, fn] of [['v3', packBinV3], ['v2', packBin]]) {
    const t0 = process.hrtime.bigint();
    const out = fn(boxes.map(b => ({ ...b })), spec, false);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const vol = out.placed.reduce((s, b) => s + b.bl * b.bh * b.bw, 0);
    const wt = out.placed.reduce((s, b) => s + b.wt, 0);
    const issues = checkBuild(out.placed, spec);
    const lost = boxes.length - out.placed.length - out.rem.length;
    const st = buildStats(out.placed, spec);
    res[label] = { cg: `CG off-centre ${Math.round(Math.hypot(st.cgOffsetL, st.cgOffsetW))} cm`, placed: out.placed.length, rem: out.rem.length, util: Math.round(vol / (spec.l * spec.w * spec.h) * 100), wt: Math.round(wt), issues, ms: ms.toFixed(1), lost };
  }
  const fmt = r => `${String(r.placed).padStart(3)} placed ${String(r.rem).padStart(3)} left  ${String(r.util).padStart(3)}% vol  ${String(r.wt).padStart(5)} kg  ${r.issues.length ? r.issues.length + ' PROBLEMS' : 'clean'}${r.lost ? '  LOST ' + r.lost : ''}  ${r.cg}  (${r.ms} ms)`;
  console.log(`\n${name}  [${code}, ${boxes.length} pcs]`);
  console.log('  v3: ' + fmt(res.v3));
  console.log('  v2: ' + fmt(res.v2));
  const kinds = r => [...new Set(r.issues.map(i => i.type))].join(', ');
  if (res.v3.issues.length) console.log('      v3 problems: ' + kinds(res.v3) + ' — e.g. ' + res.v3.issues[0].msg);
  if (res.v2.issues.length) console.log('      v2 problems: ' + kinds(res.v2) + ' — e.g. ' + res.v2.issues[0].msg);
  return res;
}

const demo = [
  { desc: '071-10001 Fresh flowers', l: 80, w: 60, h: 50, wt: 40, pcs: 3 },
  { desc: '071-10002 Auto parts', l: 120, w: 100, h: 80, wt: 180, pcs: 2 },
  { desc: '071-10003 Pharma', l: 60, w: 50, h: 40, wt: 25, pcs: 4 },
  { desc: '071-10004 Electronics', l: 90, w: 70, h: 60, wt: 60, pcs: 2 },
];

const all = [];
all.push(run('1. App demo manifest', 'AKE', demo));
all.push(run('2. Demo, Pharma marked No Stack', 'AKE', demo.map(s => s.desc.includes('Pharma') ? { ...s, noStack: true } : s)));
all.push(run('3. Mixed heavy/light on PMC', 'PMC', [
  { desc: 'Machinery', l: 120, w: 100, h: 90, wt: 650, pcs: 3 },
  { desc: 'Garments', l: 100, w: 80, h: 120, wt: 45, pcs: 6 },
  { desc: 'Courier', l: 50, w: 40, h: 40, wt: 15, pcs: 20 },
  { desc: 'Pharma', l: 80, w: 60, h: 70, wt: 120, pcs: 6, noStack: true },
]));
all.push(run('4. DG Class 3 + Class 5.1', 'PMC', [
  { desc: 'Paint (DG 3)', l: 60, w: 40, h: 40, wt: 30, pcs: 4, dg: '3' },
  { desc: 'Oxidizer (DG 5.1)', l: 60, w: 40, h: 40, wt: 30, pcs: 4, dg: '5.1' },
  { desc: 'General', l: 100, w: 80, h: 60, wt: 80, pcs: 4 },
]));
all.push(run('5. Very heavy pieces in AKE', 'AKE', [
  { desc: 'Steel parts', l: 60, w: 50, h: 40, wt: 250, pcs: 10 },
]));
all.push(run('6. Identical cartons', 'AKE', [
  { desc: 'Cartons', l: 50, w: 40, h: 40, wt: 12, pcs: 60 },
]));
all.push(run('7. LD6 with long pieces', 'LD6', [
  { desc: 'Pipes', l: 360, w: 40, h: 30, wt: 90, pcs: 4 },
  { desc: 'Boxes', l: 80, w: 60, h: 50, wt: 35, pcs: 12 },
]));

// Random manifests
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const totals = { v3: { placed: 0, bad: 0, util: 0 }, v2: { placed: 0, bad: 0, util: 0 } };
const N = 40;
console.log(`\n8. ${N} random manifests (AKE / PMC / LD6):`);
for (let k = 0; k < N; k++) {
  const code = pick(['AKE', 'PMC', 'LD6']);
  const n = 3 + Math.floor(rnd() * 5);
  const ships = Array.from({ length: n }, (_, i) => {
    const l = 30 + Math.round(rnd() * 110), w = 30 + Math.round(rnd() * 80), h = 25 + Math.round(rnd() * 80);
    return { desc: 'S' + i, l, w, h, wt: Math.round(l * w * h / 1e6 * (60 + rnd() * 300)), pcs: 1 + Math.floor(rnd() * 8),
      tiltable: rnd() < 0.3, noStack: rnd() < 0.15 };
  });
  const spec = ULD_DB[code];
  const boxes = explode(ships);
  for (const [label, fn] of [['v3', packBinV3], ['v2', packBin]]) {
    const out = fn(boxes.map(b => ({ ...b })), spec, false);
    totals[label].placed += out.placed.length;
    totals[label].bad += checkBuild(out.placed, spec).length ? 1 : 0;
    totals[label].util += out.placed.reduce((s, b) => s + b.bl * b.bh * b.bw, 0) / (spec.l * spec.w * spec.h) * 100;
  }
}
for (const k of ['v3', 'v2'])
  console.log(`  ${k}: ${totals[k].placed} pieces placed, avg ${(totals[k].util / N).toFixed(1)}% volume, ${totals[k].bad}/${N} builds with rule problems`);

// Speed: full manifest through the same loop optimize() uses
const big = Array.from({ length: 25 }, (_, i) => ({ desc: 'B' + i, l: 40 + (i * 7) % 90, w: 30 + (i * 11) % 70, h: 30 + (i * 13) % 60, wt: 20 + (i * 17) % 150, pcs: 12 }));
let rem = explode(big); const t0 = Date.now(); let ulds = 0;
for (let s = 0; s < 30 && rem.length; s++) {
  let best = null;
  for (const code of ['AKE', 'LD6', 'PMC']) {
    const out = packBin(rem, ULD_DB[code], false);
    if (out.placed.length && (!best || out.placed.length > best.placed.length)) best = out;
  }
  if (!best) break; ulds++; rem = best.rem;
}
console.log(`\n9. Speed: 300 pieces, 3 ULD types tried per position -> ${ulds} ULDs built in ${Date.now() - t0} ms, ${rem.length} left`);

