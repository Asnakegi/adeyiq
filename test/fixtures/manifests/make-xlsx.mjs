// Makes the sample .xlsx manifests from the .json files next to this script, with the self-hosted SheetJS copy.
// Run: node test/fixtures/manifests/make-xlsx.mjs
import fs from "node:fs";
import vm from "node:vm";

const here = new URL("./", import.meta.url);
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("../../../public/vendor/sheetjs/0.20.3/xlsx.full.min.js", here), "utf8"), ctx);
const XLSX = ctx.XLSX;
export function xlsxFromRows(rows, merges = []) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (merges.length) ws["!merges"] = merges.map((m) => XLSX.utils.decode_range(m));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Manifest");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
// merged cells as a real load list would have them (AWB and goods merged down over the second size line)
export const MERGES = { "merged-awb": ["A6:A7", "D6:D7", "H6:H7", "E4:G4"] };
if (import.meta.main) {
  for (const f of fs.readdirSync(here).filter((f) => f.endsWith(".json"))) {
    const name = f.replace(/\.json$/, "");
    fs.writeFileSync(new URL(name + ".xlsx", here), xlsxFromRows(JSON.parse(fs.readFileSync(new URL(f, here), "utf8")), MERGES[name]));
    console.log("wrote", name + ".xlsx");
  }
}
