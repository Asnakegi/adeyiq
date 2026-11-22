// Makes the downloadable cargo template for the Cargo Builder (public/adeyiq/adeyiq-cargo-template.xlsx and .csv)
// with the self-hosted SheetJS copy. The first sheet is the one the builder imports, so it holds only the header.
// Run after changing the fields: node scripts/make-template.mjs
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL("public/vendor/sheetjs/0.20.3/xlsx.full.min.js", root), "utf8"), ctx);
const XLSX = ctx.XLSX;

// [header in the template, required?, what to write, example]
export const FIELDS = [
  ["AWB", "Optional", "Air waybill number, like 000-12345675. Lines without one are named No AWB 1, 2 …", "000-12345675"],
  ["Goods", "Optional", "Nature of goods, shown on the ULD and the build sheet", "Spare parts"],
  ["Pieces", "Recommended", "Number of pieces with these sizes. Empty = 1", "4"],
  ["Weight kg (total) *", "Required (or weight per piece)", "Gross weight of all pieces on this line, in kg. Not chargeable weight", "480"],
  ["Weight per piece kg", "Optional", "Use instead of the total: the builder multiplies it by Pieces", ""],
  ["Length cm *", "Required", "Length of one piece in cm", "120"],
  ["Width cm *", "Required", "Width of one piece in cm", "80"],
  ["Height cm *", "Required", "Height of one piece in cm", "60"],
  ["DG class", "Optional (required for DG)", "Dangerous goods class, like 3, 8, 9, 2.2. Empty = not DG", ""],
  ["UN number", "Optional (required for DG)", "UN number, like UN1263. Needed for every DG class except 9", ""],
  ["Sub risk", "Optional", "Subsidiary hazard classes, like 6.1 or 5.1, 8", ""],
  ["SHC", "Optional", "Special handling codes separated by spaces, like PER COL or HEA", ""],
  ["Exclusive ULD (yes/no)", "Optional", "yes = this AWB gets its own ULD", ""],
  ["Overhang %", "Optional", "Overhang percentage for charging, 0 to 100", ""],
];
const HEAD = FIELDS.map((f) => f[0]);
export const EXAMPLES = [
  ["000-12345675", "Spare parts", 4, 480, "", 120, 80, 60, "", "", "", "", "", ""],
  ["000-12345686", "Paint", 10, "", 18, 40, 30, 30, "3", "UN1263", "", "", "", ""],
  ["000-12345690", "Lithium ion batteries", 2, 300, "", 100, 80, 90, "9", "UN3480", "", "", "", ""],
  ["000-12345701", "Fresh flowers", 30, 450, "", 100, 50, 40, "", "", "", "PER COL", "", ""],
  ["", "Machine on skid", 1, 2400, "", 300, 200, 150, "", "", "", "HEA", "yes", "10"],
];

function build() {
  const wb = XLSX.utils.book_new();
  const cols = HEAD.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const cargo = XLSX.utils.aoa_to_sheet([
    ["AdeyIQ cargo template · fields with * are required · one line per AWB and size · see the sheet How to fill"],
    HEAD,
  ]);
  cargo["!cols"] = cols;
  XLSX.utils.book_append_sheet(wb, cargo, "Cargo");
  const how = XLSX.utils.aoa_to_sheet([
    ["How to fill the AdeyIQ cargo template"],
    ["Fill the sheet Cargo, one line per AWB. If one AWB has pieces of different sizes, use one line per size with the same AWB."],
    ["Only the first sheet (Cargo) is imported. Keep the header row; you can add or leave out optional columns."],
    ["The file is read in your browser only: cargo data is not sent anywhere."],
    [],
    ["Column", "Required?", "What to write", "Example"],
    ...FIELDS,
  ]);
  how["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 80 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, how, "How to fill");
  const ex = XLSX.utils.aoa_to_sheet([["Example lines (copy them to the sheet Cargo to try)"], HEAD, ...EXAMPLES]);
  ex["!cols"] = cols;
  XLSX.utils.book_append_sheet(wb, ex, "Example");
  return wb;
}

if (import.meta.main) {
  const out = new URL("public/adeyiq/", root);
  fs.writeFileSync(new URL("adeyiq-cargo-template.xlsx", out), Buffer.from(XLSX.write(build(), { type: "buffer", bookType: "xlsx" })));
  const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  fs.writeFileSync(new URL("adeyiq-cargo-template.csv", out), HEAD.map(csvCell).join(",") + "\r\n");
  console.log("wrote public/adeyiq/adeyiq-cargo-template.xlsx and .csv");
}
