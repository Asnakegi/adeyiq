// Parses (without running) every Apps Script file and every browser script of the static product pages, so a
// broken edit fails CI before it can be pasted into Apps Script or deployed. Run: npm run check:scripts
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const files = [];
for (const f of fs.readdirSync(path.join(root, "scripts"))) if (f.endsWith(".gs")) files.push(["scripts/" + f, fs.readFileSync(path.join(root, "scripts", f), "utf8")]);
for (const f of fs.readdirSync(path.join(root, "public/adeyiq"))) {
  const p = path.join(root, "public/adeyiq", f), rel = "public/adeyiq/" + f;
  if (f.endsWith(".js")) files.push([rel, fs.readFileSync(p, "utf8")]);
  if (f.endsWith(".html")) {
    const html = fs.readFileSync(p, "utf8"), re = /<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/(?:ld\+)?json|text\/template)")[^>]*>([\s\S]*?)<\/script>/gi;
    let m, i = 0;
    while ((m = re.exec(html))) files.push([`${rel} <script #${++i}>`, m[1]]);
  }
}
let bad = 0;
for (const [name, code] of files) {
  try { new vm.Script(code, { filename: name }); } catch (e) { bad++; console.error(`SYNTAX ERROR  ${name}: ${e.message}`); }
}
console.log(bad ? `${bad} of ${files.length} scripts have syntax errors` : `All ${files.length} scripts parse (${files.filter((f) => f[0].endsWith(".gs")).length} Apps Script files)`);
process.exit(bad ? 1 : 0);
