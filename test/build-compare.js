// Builds compare.html from the v3 source and packer-v2.js.  Usage: node test/build-compare.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'public', 'adeyiq_cargo_optimizer_v3.html'), 'utf8').split(/\r?\n/);
const s = lines.findIndex(l => l.startsWith('const ULD_DB={'));
const e = lines.findIndex((l, i) => i > s && l.startsWith('function getSelectedULDs('));
const v3 = lines.slice(s, e).join('\n').replace('function packBin(', 'function packBinV3(');
const v2 = fs.readFileSync(path.join(root, 'packer-v2.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
const tpl = fs.readFileSync(path.join(__dirname, 'compare-template.html'), 'utf8');
fs.writeFileSync(path.join(root, 'compare.html'), tpl.replace('/*__V3_CODE__*/', () => v3).replace('/*__V2_CODE__*/', () => v2));
console.log('compare.html written');
