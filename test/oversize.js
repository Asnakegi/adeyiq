// Oversize / overhang / door-fit checks.  Usage:  node test/oversize.js
// Piece sizes are illustrative (GE90 numbers rounded from the planner's table).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'public', 'adeyiq_cargo_optimizer_v3.html'), 'utf8').split(/\r?\n/);
const s = lines.findIndex(l => l.startsWith('const ULD_DB={'));
const e = lines.findIndex((l, i) => i > s && l.startsWith('function getSelectedULDs('));
const v3 = lines.slice(s, e).join('\n').replace('function packBin(', 'function packBinV3(');
const v2 = fs.readFileSync(path.join(root, 'packer-v2.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
const ctx = { console, Math, Set, Map, document: {} };
vm.createContext(ctx);
vm.runInContext(v3 + '\n' + v2 + '\nthis.API={ULD_DB,packBin,checkBuild,doorFitReason};', ctx);
const { ULD_DB, packBin, checkBuild, doorFitReason } = ctx.API;

const DOOR_777F_MAIN = { w: 360, h: 305 };   // 142 in x 120 in side cargo door
let fails = 0;
const expect = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };

console.log('\nDoor fit (B777F main deck side cargo door 360 x 305 cm)');
const assembled = { desc: 'GE90-115B assembled', l: 520, w: 340, h: 392, wt: 9000 };
const core = { desc: 'GE90 core (split)', l: 300, w: 254, h: 168, wt: 4000 };
const r1 = doorFitReason(assembled, DOOR_777F_MAIN);
expect(r1 !== null, `assembled engine rejected: ${r1}`);
const r2 = doorFitReason(core, DOOR_777F_MAIN);
expect(r2 === null, 'split core fits the door');
expect(doorFitReason({ ...assembled, tiltable: true }, DOOR_777F_MAIN) !== null, 'assembled engine still rejected even if tilting were allowed (325 cm fan > 305 cm door)');
expect(doorFitReason({ l: 200, w: 120, h: 100 }, { w: 175, h: 127 }) === null, 'normal crate fits a B788 lower-deck door');

console.log('\nOverhang on PMC (317.5 x 243.8 cm base, limits 25 cm/end, 15 cm/side)');
const pmc = ULD_DB.PMC;
let out = packBin([{ ...core, piece: 1 }], pmc, false);
const p = out.placed[0];
expect(out.placed.length === 1, 'GE90 core placed on a PMC');
expect(p && p.overhang && p.ovCm === 5, `marked as overhang, ${p && p.ovCm} cm per side (254 - 243.8 = 10.2 cm total)`);
expect(p && p.ovDetail.left === 5 && p.ovDetail.right === 5, `centred: left ${p && p.ovDetail.left} cm / right ${p && p.ovDetail.right} cm`);
expect(checkBuild(out.placed, pmc).length === 0, 'build passes all checks');

out = packBin([{ desc: 'Too wide', l: 300, w: 290, h: 100, wt: 800, piece: 1 }], pmc, false);
expect(out.placed.length === 0, '300 x 290 cm piece rejected on PMC (too wide either way round)');

out = packBin([{ desc: 'Long beam', l: 380, w: 100, h: 60, wt: 500, piece: 1 }], pmc, false);
expect(out.placed.length === 0, '380 cm long piece rejected on PMC (31 cm/end > 25 cm limit)');
out = packBin([{ desc: 'Long beam', l: 380, w: 100, h: 60, wt: 500, piece: 1 }], ULD_DB.PGA, false);
expect(out.placed.length === 1 && !out.placed[0].overhang, '...but fits a 20 ft PGA with no overhang');

out = packBin([{ desc: 'Long beam', l: 360, w: 100, h: 60, wt: 500, piece: 1 }], pmc, false);
expect(out.placed.length === 1 && out.placed[0].ovCm === 21, `360 cm piece on PMC: ${out.placed[0] && out.placed[0].ovCm} cm overhang each end`);

console.log('\nMixed: core plus normal cargo on one PMC');
out = packBin([{ ...core, piece: 1 }, ...Array.from({ length: 6 }, (_, i) => ({ desc: 'Spares box', l: 60, w: 40, h: 40, wt: 30, piece: i + 1 }))], pmc, false);
const normals = out.placed.filter(b => !b.ovDetail);
expect(out.placed.some(b => b.ovDetail), 'core loaded');
expect(normals.every(b => !b.overhang), `normal boxes never overhang (${normals.length} loaded with it)`);
expect(checkBuild(out.placed, pmc).length === 0, 'mixed build passes all checks');

console.log('\nContainers never overhang');
out = packBin([{ desc: 'Wide box', l: 100, w: 160, h: 100, wt: 100, piece: 1 }], ULD_DB.AKE, false);
expect(out.placed.length === 0, 'piece wider than AKE base is not loaded in an AKE');

console.log(fails ? `\n${fails} FAILED` : '\nAll oversize checks passed');
process.exit(fails ? 1 : 0);
