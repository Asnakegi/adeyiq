/* AdeyIQ help: the "? Help" button on every product page. Four tabs (Start, Tools, Questions, Glossary), one search box,
   "Show me" buttons that point at a tool in the Cargo Builder, and a short guided tour.
   All texts are fixed and written here; nothing the visitor types is put into the page as HTML and nothing is sent anywhere.
   Facts here must match public/adeyiq/build.html. */
(function () {
  "use strict";
  var ON_BUILD = !!document.getElementById("st2") && !!document.getElementById("acSel");
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function norm(s) { return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, ""); }

  /* ---------- start ---------- */
  var START = [
    ["Choose your aircraft", "Use the list at the top right of the Cargo Builder. The ULD types, contours, doors and limits follow the aircraft.", "aircraft"],
    ["Add your cargo", "Type shipments with Add Cargo, or import an Excel or CSV manifest. New here? Press Try sample cargo.", "add"],
    ["Look at the ULDs", "AdeyIQ builds the containers and pallets at once. Click a ULD to see every piece in 3D, its weight and its space.", "strip"],
    ["Change what you want", "Pick a place in Load on, or open a ULD and use Load, Offload or Maximize to contour. Undo brings the automatic plan back.", "list"],
    ["Load to aircraft", "Step 2 gives each ULD a position and checks weight, balance, payload and dangerous goods.", "load"],
    ["Read the checks and print", "Solve the red messages first, then print the load plan and build sheets, or save them as PDF or HTML.", "print"]
  ];
  var PLACES = [
    ["/", "Home", "What AdeyIQ does, the modules and how to contact us."],
    ["/build", "Cargo Builder", "The main tool: build ULDs, then load the aircraft."],
    ["/hold-view", "Hold view", "A demo of cargo inside the aircraft holds."],
    ["/aircraft-data", "Aircraft and ULD data", "Doors, holds, contours and ULD types, with sources."],
    ["/privacy", "Privacy", "What is counted and what stays on your device."]
  ];

  /* ---------- tools: key, group, name, text, CSS selector, where it lives (step 1/2, more = More tools, rules) ---------- */
  var TOOLS = [
    ["aircraft", "Step 1 · Build ULDs", "Aircraft list", "Choose the aircraft for the flight. The build is done again when you change it.", "#acSel", ""],
    ["add", "Step 1 · Build ULDs", "Add Cargo", "Type one shipment: pieces, weight and size per piece are needed. The AWB number is optional. “+ More” opens handling codes, overhang and own ULD.", "#addToggle", "1"],
    ["import", "Step 1 · Build ULDs", "Import Manifest / CSV", "Read an Excel (.xlsx, .xls) or CSV file, up to 10 MB. AdeyIQ looks for pieces, weight and sizes even when column names differ, then shows what it used and what it skipped.", "#upBtn", "1"],
    ["template", "Step 1 · Build ULDs", "Cargo template", "An Excel or CSV file to fill in and import. Required columns are marked with *.", "#tplBtn", "1 more"],
    ["sample", "Step 1 · Build ULDs", "Try sample cargo", "Adds example shipments so you can look around safely.", "#sampleBtn", "1"],
    ["list", "Step 1 · Build ULDs", "☰ Cargo list", "See, edit or remove shipments. “Load on” puts a shipment on a pallet or container you choose; Auto-Assign ULD lets AdeyIQ decide. Clear all deletes the cargo saved in this browser.", "#listToggle", "1"],
    ["rec", "Step 1 · Build ULDs", "Recommended aircraft", "Suggests an aircraft type for your cargo and how many flights it needs. A planning aid, not a schedule.", "#rec", "1"],
    ["strip", "Step 1 · Build ULDs", "ULD chips", "One chip per container or pallet. The percentage is the fuller of weight and space. Click one to open it.", "#strip", "1"],
    ["iso", "Step 1 · Build ULDs", "3D view", "Drag to turn (or use the arrow keys). Click a box to select it; hold Ctrl or Shift to add more and see their total weight and volume.", "#iso", "1"],
    ["hand", "Step 1 · Build ULDs", "Load, Offload, Maximize", "Buttons inside an open ULD. Load puts it on first, Offload takes it off, Maximize adds pieces that still fit the contour, weight and DG rules.", "#info", "1"],
    ["printuld", "Step 1 · Build ULDs", "Print ULD", "Build sheet for the open ULD. Choose Save as PDF in the print window to keep a file.", "#prtUld", "1"],
    ["dg", "Step 1 · Build ULDs", "DG acceptance", "Type a UN number or part of a name. It shows whether the goods can go on this aircraft and what they must be kept apart from. Always confirm in the IATA DGR.", "#dgBtn", "1 more"],
    ["engine", "Step 1 · Build ULDs", "Engines & gear", "Checks which aircraft can take an engine or landing gear of the size you enter.", "#engToggle", "1 more"],
    ["spec", "Step 1 · Build ULDs", "Aircraft spec", "Opens the data page: doors, holds, contours and ULDs.", "#specBtn", "1 more"],
    ["load", "Step 1 · Build ULDs", "Load to aircraft", "Goes to step 2 with the ULDs you built.", "#toLoad", "1"],
    ["side", "Step 2 · Load aircraft", "Aircraft side view", "Each colour is one AWB. Hover a ULD to read it, click to select it, drag to move the view, + and − to zoom.", ".acstage", "2"],
    ["bench", "Step 2 · Load aircraft", "Build-up and loading", "Replays how the selected ULD is built and loaded. “Inside the hold” shows it in the aircraft.", "#benchCard", "2"],
    ["summary", "Step 2 · Load aircraft", "Load summary and balance", "Number of ULDs, weights, and the balance dot between the nose and tail limits.", ".load", "2"],
    ["checks", "Step 2 · Load aircraft", "Checks", "Green means placed and within limits. Red lists what was offloaded or is over a limit, with the reason.", "#loadAlerts", "2"],
    ["pay", "Step 2 · Load aircraft", "Max payload", "The default is a placeholder. Type your airline’s figure for the flight; it is kept in this browser only.", "#payMax", "2"],
    ["rebalance", "Step 2 · Load aircraft", "Rebalance", "Places the ULDs again to bring the balance back.", "#reassign", "2"],
    ["print", "Step 2 · Load aircraft", "Print / PDF and HTML", "The load plan with a build sheet for every ULD: print it, save it as PDF, or save one HTML file.", "#prtFlight", "2"],
    ["m2", "Module 2 · Optimize revenue", "💲 Module 2 · Revenue", "In More tools. Opens with an access code (ask for one on the home page). Then each shipment gets a rate per chargeable kg and a priority (Contract, Mail or Standby), and you choose one currency for the flight. Rates stay in this browser.", "#m2Btn", "1 more"],
    ["m2plan", "Module 2 · Optimize revenue", "Revenue view and report", "The Module 2 bar shows the revenue planned to fly, what is left behind and the yield. When cargo must stay behind, “Offload by revenue first” keeps Contract and Mail, then loads the highest-revenue ULDs, and shows the difference against heaviest first. 🖨 Revenue report prints it (or Save as PDF); ⬇ HTML saves one file.", "#m2Btn", "1 more"],
    ["rules", "Settings and feedback", "Rules and limits", "Divisor, pivot weights, ULD weights and balance limits. Replace the placeholders with your airline’s figures.", ".settings", "rules"],
    ["rate", "Settings and feedback", "Rate AdeyIQ", "Five quick questions that help us make the build match real ramp work.", "#rateBtn", ""]
  ];

  /* ---------- questions ---------- */
  var FAQ = [
    ["Is my cargo sent to AdeyIQ?", "No. Shipments stay in this browser on this device. Use ☰ Cargo, Clear all when you finish on a shared computer."],
    ["Why is a shipment or ULD not loaded?", "Open the red “not loaded” message in step 1 or Checks in step 2. Common reasons: too big for the door or contour, no position left, over the max payload, Cargo Aircraft Only on a passenger aircraft, or offloaded by hand."],
    ["My Excel file was read wrongly. What can I do?", "Read the import summary: it says which column was used for each field and which rows were skipped. Rename the column (for example Pieces, Weight kg, Dims) or use the cargo template, then import again."],
    ["Can I use the result as a load sheet?", "No. AdeyIQ is a planning aid. Position, zonal and balance limits are placeholders until your airline’s figures are entered, and the final load sheet comes from the airline’s approved system."],
    ["Does it replace a dangerous goods acceptance check?", "No. It follows IATA DGR Table 9.3.A for separation in the build and gives a quick lookup. A trained person must do the acceptance with the current IATA DGR and operator rules."],
    ["How do I undo changes I made by hand?", "Open a ULD and press Undo hand changes. Change Load on back to Auto-Assign ULD in the cargo list."],
    ["How do I start again?", "Open ☰ Cargo and press Clear all. This deletes the cargo saved in this browser."],
    ["Does it work on a phone?", "Yes, for checking and small changes. A computer is easier for big loads, 3D and printing."],
    ["Are modules 2 and 3 ready?", "Module 2, Optimize revenue, is open in early access to people with an access code: ask for one from the home page. Module 3, Bid your space, is planned. Module 1, the Cargo Builder, is free now."],
    ["How is revenue worked out in Module 2?", "Chargeable kg × the rate per kg you type. Chargeable kg is the higher of gross weight and volumetric weight. A shipment split over ULDs is shared by pieces. Surcharges, pivot and overhang charges are not added, so it is a planning figure, not an invoice."],
    ["What does “Offload by revenue first” do?", "It only matters when not everything fits. ULDs with Contract or Mail go on first, then the ones that earn the most; Standby is left behind first. Balance, payload and DG checks stay the same. The Module 2 bar compares the result with the normal heaviest-first plan, and you can switch back."],
    ["Does the load plan printout show revenue?", "No. The load plan and build sheets go to the ramp, so they never show money. Print the revenue report from the Module 2 bar instead."]
  ];

  /* ---------- glossary: group, term, also searched as, meaning ---------- */
  var G = "Shipment and weight", U = "ULDs and build-up", A = "Aircraft and loading", D = "Dangerous goods", S = "Handling codes (SHC)", B = "Business and people";
  var TERMS = [
    [G, "AWB", "air waybill", "Air waybill: the transport document of a shipment. Its number has 11 digits: a 3-digit airline prefix and 8 more, like 071-12345675."],
    [G, "Shipment", "consignment", "Cargo moving under one AWB. It can have one piece or many."],
    [G, "Piece", "pcs pieces package", "One box, crate or item that is handled on its own."],
    [G, "Manifest", "cargo manifest", "The list of shipments on a flight. You can import it as Excel or CSV."],
    [G, "Nature of goods", "commodity goods", "What the cargo is, for example fresh flowers or auto parts."],
    [G, "Dimensions", "dims size l w h", "Length × width × height of one piece, packed, in centimetres."],
    [G, "Gross weight", "actual weight kg", "The real weight of the cargo with its packing, in kilograms."],
    [G, "Volume", "m3 cbm cubic", "Space taken by the pieces, in cubic metres (m³)."],
    [G, "Volumetric weight", "volume weight divisor", "Space turned into kilograms: L × W × H in cm × pieces ÷ the volumetric divisor (6000 by default, so 1 m³ is about 167 kg)."],
    [G, "Volumetric divisor", "6000", "The number used to turn space into kilograms. You can change it in Rules and limits."],
    [G, "Chargeable weight", "chg", "The weight used for the price: the higher of gross weight and volumetric weight."],
    [G, "Pivot weight", "minimum charge", "A minimum chargeable weight for a whole ULD. In AdeyIQ it is used for own-ULD and overhang shipments and for 20 ft pallets."],
    [U, "ULD", "unit load device", "Unit load device: a container or pallet that cargo is loaded on before it goes into the aircraft."],
    [U, "Container", "", "A closed ULD with a fixed shape, such as AKE or AKH."],
    [U, "Pallet", "pmc pag pga net", "A flat ULD. Cargo is stacked on it and held by a net."],
    [U, "AKE", "ld3", "Lower-deck container for wide-body aircraft, also called LD3. Contour height 163 cm."],
    [U, "AKH", "ld3-45 ld3 45", "Low lower-deck container for the A320 family, also called LD3-45. Contour height 114 cm."],
    [U, "PMC", "p6p 96", "Pallet with a 318 × 244 cm base, used on lower and main decks."],
    [U, "PAG", "p1p 88", "Pallet with a 318 × 224 cm base. AdeyIQ uses it on the 737 freighter."],
    [U, "PGA", "20 ft 20ft", "20-foot pallet, 606 × 244 cm, for long cargo on a freighter main deck."],
    [U, "LD7", "", "A lower-deck pallet load, up to 163 cm high."],
    [U, "Q6 and Q7 contour", "main deck contour", "Main-deck shapes. In AdeyIQ, Q6 is built to 244 cm high and Q7 to 300 cm high."],
    [U, "Contour", "profile shape", "The outline the built ULD must stay inside so that it fits the curve of the aircraft. Each ULD and deck has its own."],
    [U, "Build-up", "", "Loading pieces onto a ULD. Taking them off again is break-down."],
    [U, "Build sheet", "", "A page for the ramp team: the pieces on one ULD, their weight, codes and notes."],
    [U, "Base", "footprint", "The floor size of a ULD, for example 318 × 244 cm for a PMC."],
    [U, "Overhang", "ohg", "Cargo that goes past the edge of the pallet base. It can reduce what fits next to it and can raise the charge."],
    [U, "Own ULD", "exclusive bup", "The shipment gets its own ULD; no other cargo is put on it."],
    [U, "Mixed ULD", "consolidation", "One ULD carrying pieces from several AWBs."],
    [U, "Merge check", "", "AdeyIQ looks whether the cargo of a small ULD can move into free space on others, so that one ULD less is used."],
    [U, "Maximize to contour", "", "Adds more pieces to a ULD while its weight, space, shape and DG rules allow."],
    [U, "Load on", "manual pallet pin auto-assign", "Your choice of pallet or container for a shipment. Auto-Assign ULD means AdeyIQ decides."],
    [U, "Out of gauge", "oog", "Cargo too large for any ULD in the tool."],
    [U, "Packing efficiency", "", "The share of a ULD’s space that can really be filled, because pieces never fit perfectly."],
    [U, "Utilization %", "percent fill", "How full a ULD is. The chip shows the higher of its weight share and space share."],
    [U, "Bulk loading", "loose bulk", "Loose pieces loaded directly into a hold, without a ULD."],
    [A, "Wide-body", "", "Aircraft with two aisles, such as the 787, 777 or A350. Their lower decks take ULDs."],
    [A, "Narrow-body", "", "Aircraft with one aisle, such as the 737 or A320. Cargo is mostly bulk; the A320 family can take AKH."],
    [A, "Freighter", "", "An aircraft that carries cargo only, usually with a main deck for pallets."],
    [A, "Converted freighter", "bcf", "A passenger aircraft changed into a freighter, for example the 737-800BCF."],
    [A, "Lower deck", "belly", "The space under the main floor, also called the belly."],
    [A, "Main deck", "", "The upper floor. On a freighter it carries tall pallets."],
    [A, "Hold", "forward aft bulk compartment", "A cargo compartment of the lower deck: forward, aft or bulk."],
    [A, "Position", "row slot", "A marked place in the aircraft for one ULD."],
    [A, "Centreline position", "centerline", "A main-deck place in the middle of the aircraft, for wide or tall cargo."],
    [A, "Cargo door", "", "The opening that cargo passes through. Its width and height limit the size of pieces and ULDs."],
    [A, "Max payload", "payload", "The most cargo weight for the flight. The default in AdeyIQ is a placeholder: enter your own figure."],
    [A, "Weight and balance", "w&b", "Checking that the aircraft is not too heavy and that its weight is not too far forward or back."],
    [A, "Centre of gravity", "cg", "The point where the aircraft balances. It must stay inside limits."],
    [A, "Balance index", "index nose tail", "A number for how far the load moves the balance: negative is towards the nose, positive towards the tail. AdeyIQ’s limits are placeholders."],
    [A, "Offload", "", "To leave cargo off the flight, by rule or by hand."],
    [A, "Load plan", "", "Which ULD goes in which position."],
    [A, "Load sheet", "", "The official weight and balance document, from the airline’s approved system. AdeyIQ does not make it."],
    [A, "Zonal limit", "floor limit", "The most weight allowed in one part of the aircraft floor."],
    [D, "DG", "dangerous goods dgr", "Dangerous goods: things that can be a risk to health, safety or property when carried by air."],
    [D, "IATA DGR", "dangerous goods regulations", "The IATA Dangerous Goods Regulations, the yearly rule book used by airlines."],
    [D, "DG class", "hazard class division", "The type of danger, from 1 (explosives) to 9 (miscellaneous), some with divisions such as 2.1."],
    [D, "UN number", "un", "A four-digit number for a dangerous substance or article, such as UN1263 (paint)."],
    [D, "Subsidiary hazard", "sub risk sub hazard", "A second danger of the same goods, for example class 8 with subsidiary 5.1."],
    [D, "Packing group", "pg", "How dangerous a substance is for packing: I high, II medium, III low."],
    [D, "Segregation", "keep apart", "Keeping goods that react with each other in separate places. AdeyIQ follows IATA DGR Table 9.3.A."],
    [D, "CAO", "cargo aircraft only", "Cargo Aircraft Only: not allowed on passenger aircraft."],
    [D, "NOTOC", "notification to captain", "Notification to Captain: the list of dangerous and special cargo given to the pilot."],
    [D, "Acceptance check", "", "The check a trained person makes before taking dangerous goods. The lookup in AdeyIQ is only a help."],
    [D, "Lithium batteries", "un3480 un3090 un3551 sodium", "UN3480 (lithium ion), UN3090 (lithium metal) and UN3551 (sodium ion) alone are Cargo Aircraft Only and kept apart from several classes."],
    [S, "SHC", "special handling code", "Special handling code: three letters that tell staff how to treat cargo."],
    [S, "GEN", "general", "General cargo, no special handling."],
    [S, "PER", "perishable", "Perishable cargo that can spoil."],
    [S, "EAT", "food", "Food for people. Kept away from toxic goods."],
    [S, "PEF", "flowers", "Flowers."],
    [S, "PEM", "meat", "Meat."],
    [S, "PES", "fish seafood", "Fish or seafood."],
    [S, "PIL", "pharma medicine", "Pharmaceuticals."],
    [S, "COL", "cool", "Cool goods that need a controlled low temperature."],
    [S, "Cold chain", "", "Keeping goods at the right low temperature all the way. AdeyIQ marks COL, PIL, PEM, PEF, PER and PES."],
    [S, "AVI", "animals", "Live animals."],
    [S, "HEG", "eggs", "Hatching eggs."],
    [S, "HEA", "heavy", "Heavy piece, usually 150 kg or more."],
    [S, "VUN", "vulnerable", "Vulnerable cargo that needs extra care against theft."],
    [S, "FIL", "film", "Undeveloped film. Kept away from radioactive goods."],
    [S, "ICE", "dry ice un1845", "Dry ice. Kept away from live animals and hatching eggs."],
    [S, "RRY", "radioactive", "Radioactive, category II or III yellow."],
    [S, "RFL", "flammable liquid", "Flammable liquid (class 3)."],
    [S, "RFG", "flammable gas", "Flammable gas (2.1)."],
    [S, "RNG", "gas", "Non-flammable, non-toxic gas (2.2)."],
    [S, "ROX", "oxidizer", "Oxidizer (5.1)."],
    [S, "RPB", "toxic", "Toxic substance (6.1)."],
    [S, "RCM", "corrosive", "Corrosive (class 8)."],
    [S, "ECC", "e-awb electronic", "The AWB contract is electronic, with no paper AWB."],
    [B, "IATA", "", "International Air Transport Association: sets many of the rules airlines use."],
    [B, "Ramp", "apron", "The area where aircraft are parked and loaded."],
    [B, "Load control", "", "The team that plans the load and makes the load sheet."],
    [B, "Ground handler", "handling agent", "The company that builds ULDs and loads aircraft for airlines."],
    [B, "Forwarder", "freight forwarder", "A company that books air cargo for shippers."],
    [B, "GSA", "general sales agent", "General sales agent: sells an airline’s cargo space in a country."],
    [B, "Capacity", "", "The weight and space a flight can still sell."],
    [B, "Yield", "revenue per kg", "Money earned per chargeable kilogram: revenue ÷ chargeable kg."],
    [B, "Rate per kg", "rate tariff price", "The price agreed for one chargeable kilogram of a shipment. In Module 2 you type it per shipment, in the flight’s currency."],
    [B, "Revenue", "income money", "What a shipment earns: chargeable kg × rate per kg (Module 2 adds no surcharges)."],
    [B, "Priority", "booking priority", "How important it is that a shipment flies: Contract, Mail, Normal or Standby. Module 2 keeps Contract and Mail and leaves Standby behind first."],
    [B, "Contract cargo", "allotment bsa guaranteed block space", "Cargo under an agreement that guarantees space, such as an allotment or block space agreement."],
    [B, "Standby", "sby", "Cargo that may fly if there is room. It is the first to be left behind."],
    [B, "Revenue first", "offload order", "A Module 2 choice for when cargo must stay behind: Contract and Mail first, then the highest-revenue ULDs, instead of the heaviest first."],
    [B, "Access code", "unlock", "A code that opens Module 2 in your browser. Ask for one from the home page."],
    [B, "Bid", "floor price", "A price offered for open space on a flight. The floor price is the lowest one accepted."]
  ];

  /* ---------- look ---------- */
  var css = ".adqh{font:inherit;font-size:14px;font-weight:600;padding:8px 14px;border-radius:999px;border:1px solid var(--line,#E3E8EE);background:var(--panel,#fff);color:var(--fg,#0A2540);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;min-height:40px}" +
    ".adqh i{font-style:normal;width:20px;height:20px;border-radius:50%;background:var(--accent,#FFD21F);color:#0A2540;display:grid;place-items:center;font-size:13px;font-weight:700}" +
    ".adqh:hover{border-color:var(--link,#635BFF)}" +
    ".adqFab{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:15;box-shadow:0 8px 24px -6px rgba(10,37,64,.4)}" +
    "html:has(#adqHelp[open]){overflow:hidden}" +
    "#adqHelp{border:0;padding:0;margin:auto;width:min(820px,calc(100% - 24px));max-width:none;height:min(760px,calc(100dvh - 24px));max-height:none;border-radius:18px;background:var(--panel,#fff);color:var(--fg,#0A2540);overflow:hidden;box-shadow:0 24px 60px -12px rgba(10,37,64,.5);font-size:15px;line-height:1.55;text-align:left}" +
    "#adqHelp::backdrop{background:rgba(10,37,64,.6)}" +
    "#adqHelp *{box-sizing:border-box}" +
    ".adqIn{display:flex;flex-direction:column;height:100%}" +
    ".adqTop{padding:16px 18px 0;display:flex;flex-direction:column;gap:12px;border-bottom:1px solid var(--line,#E3E8EE)}" +
    ".adqHd{display:flex;align-items:center;gap:10px}.adqHd h2{margin:0;flex:1;font-size:24px;line-height:1.1}" +
    ".adqX{width:40px;height:40px;border-radius:50%;border:1px solid var(--line,#E3E8EE);background:transparent;color:inherit;font:inherit;font-size:20px;line-height:1;cursor:pointer;flex:none}" +
    ".adqQ{font:inherit;font-size:16px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#E3E8EE);background:var(--bg,#F6F9FC);color:inherit}" +
    ".adqTabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}.adqTabs button{font:inherit;font-size:14px;font-weight:600;padding:9px 12px 11px;border:0;border-bottom:3px solid transparent;background:none;color:var(--muted,#425466);cursor:pointer;white-space:nowrap}" +
    ".adqTabs button[aria-selected=true]{color:inherit;border-color:var(--accent,#FFD21F)}" +
    ".adqBody{flex:1;overflow:auto;overscroll-behavior:contain;padding:16px 18px 22px}" +
    ".adqBody h3{font-size:18px;line-height:1.2;margin:20px 0 8px}.adqBody h3:first-child{margin-top:0}" +
    ".adqBody p{margin:0;color:var(--muted,#425466)}" +
    ".adqSteps{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:12px}.adqSteps li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:12px;align-items:start}" +
    ".adqSteps li>i{width:30px;height:30px;border-radius:9px;background:var(--accent,#FFD21F);color:#0A2540;display:grid;place-items:center;font-style:normal;font-weight:700}" +
    ".adqBody b{font-weight:600;color:var(--fg,#0A2540)}" +
    ".adqB{font:inherit;font-size:13px;font-weight:600;padding:7px 12px;border-radius:9px;border:1px solid var(--line,#E3E8EE);background:transparent;color:var(--link,#635BFF);cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-block}" +
    ".adqB.pri{background:var(--accent,#FFD21F);border-color:transparent;color:#0A2540;font-size:15px;padding:10px 16px}" +
    ".adqRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;padding:11px 0;border-top:1px solid var(--line,#E3E8EE)}" +
    ".adqRow:first-of-type{border-top:0}.adqRow p{font-size:14.5px}" +
    ".adqG{margin:0;display:grid;grid-template-columns:minmax(110px,170px) minmax(0,1fr);gap:0 16px}.adqG dt{font-weight:600;padding:9px 0;border-top:1px solid var(--line,#E3E8EE);overflow-wrap:anywhere}.adqG dd{margin:0;padding:9px 0;border-top:1px solid var(--line,#E3E8EE);color:var(--muted,#425466);font-size:14.5px}" +
    ".adqBody details{border-top:1px solid var(--line,#E3E8EE);padding:11px 0}.adqBody details:first-of-type{border-top:0}.adqBody summary{cursor:pointer;font-weight:600}.adqBody details p{margin-top:6px}" +
    ".adqN{font-size:13px;color:var(--muted,#425466);margin:0 0 4px}" +
    ".adqSpot{outline:3px solid #F5A524!important;outline-offset:4px;border-radius:10px;box-shadow:0 0 0 8px rgba(255,210,31,.35)!important}" +
    "#adqTour{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:60;width:min(460px,calc(100% - 24px));background:var(--panel,#fff);color:var(--fg,#0A2540);border:2px solid var(--accent,#FFD21F);border-radius:16px;padding:14px 16px;box-shadow:0 18px 44px -10px rgba(10,37,64,.5);display:grid;gap:8px;font-size:15px;line-height:1.5}" +
    "#adqTour p{margin:0;color:var(--muted,#425466)}#adqTour .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#adqTour .r span{flex:1;font-size:13px;color:var(--muted,#425466)}" +
    "@media (max-width:560px){.adqSteps li{grid-template-columns:30px minmax(0,1fr)}.adqSteps li .adqB{grid-column:2;justify-self:start}.adqRow{grid-template-columns:minmax(0,1fr)}.adqRow .adqB{justify-self:start}.adqG{grid-template-columns:minmax(0,1fr)}.adqG dt{padding-bottom:0}.adqG dd{border-top:0;padding-top:2px}}" +
    "@media print{.adqh,#adqTour{display:none!important}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- dialog ---------- */
  var dlg, body, q, tab = "start";
  var TABS = [["start", "Start"], ["tools", "Tools"], ["faq", "Questions"], ["glossary", "Glossary"]];
  function showBtn(key) {
    return ON_BUILD ? '<button class="adqB" type="button" data-show="' + key + '">Show me</button>'
      : '<a class="adqB" href="/build?help=' + key + '">Show me</a>';
  }
  function toolRow(t) { return '<div class="adqRow"><div><b>' + esc(t[2]) + "</b><p>" + esc(t[3]) + "</p></div>" + showBtn(t[0]) + "</div>"; }
  function faqRow(f, open) { return "<details" + (open ? " open" : "") + "><summary>" + esc(f[0]) + "</summary><p>" + esc(f[1]) + "</p></details>"; }
  function termList(list) { return '<dl class="adqG">' + list.map(function (t) { return "<dt>" + esc(t[1]) + "</dt><dd>" + esc(t[3]) + "</dd>"; }).join("") + "</dl>"; }
  function grouped(list, at, row) {
    var out = "", names = [];
    list.forEach(function (x) { if (names.indexOf(x[at]) < 0) names.push(x[at]); });
    names.forEach(function (n) { out += "<h3>" + esc(n) + "</h3>" + row(list.filter(function (x) { return x[at] === n; })); });
    return out;
  }
  var contact = '<h3>Still need help?</h3><p>Write or call us from the <a href="/#contact">contact card</a> on the home page.</p>';
  function view() {
    if (tab === "start") return "<h3>From cargo to load plan in six steps</h3>" +
      (ON_BUILD ? '<button class="adqB pri" type="button" data-tour>▶ Take the 1-minute tour</button>' : '<a class="adqB pri" href="/build?help=tour">▶ Take the 1-minute tour</a>') +
      '<ol class="adqSteps">' + START.map(function (s, i) { return '<li><i aria-hidden="true">' + (i + 1) + "</i><div><b>" + esc(s[0]) + "</b><p>" + esc(s[1]) + "</p></div>" + showBtn(s[2]) + "</li>"; }).join("") + "</ol>" +
      "<h3>Where things are</h3>" + PLACES.map(function (p) { return '<div class="adqRow"><div><b>' + esc(p[1]) + "</b><p>" + esc(p[2]) + '</p></div><a class="adqB" href="' + p[0] + '">Open</a></div>'; }).join("") +
      "<h3>Please remember</h3><p>AdeyIQ is a planning aid. It does not replace your airline’s load control, dangerous goods acceptance or approved load sheet.</p>" + contact;
    if (tab === "tools") return grouped(TOOLS, 1, function (l) { return l.map(toolRow).join(""); });
    if (tab === "faq") return FAQ.map(function (f) { return faqRow(f); }).join("") + contact;
    return '<p class="adqN">' + TERMS.length + " terms. Type in the search box to find one.</p>" + grouped(TERMS, 0, termList);
  }
  function found(text) {
    var words = norm(text).split(/\s+/).filter(Boolean);
    function hit() { var h = norm([].slice.call(arguments).join(" ")); return words.every(function (w) { return h.indexOf(w) >= 0; }); }
    var first = words.join(" ");
    var terms = TERMS.filter(function (t) { return hit(t[1], t[2], t[3]); }).sort(function (x, y) {
      function rank(t) { var n = norm(t[1]); return n === first ? 0 : n.indexOf(first) === 0 ? 1 : hit(t[1], t[2]) ? 2 : 3; }
      return rank(x) - rank(y);
    });
    var tools = TOOLS.filter(function (t) { return hit(t[2], t[3]); }), faq = FAQ.filter(function (f) { return hit(f[0], f[1]); });
    if (!terms.length && !tools.length && !faq.length) return "<h3>Nothing found</h3><p>Try a shorter word, or open the Glossary tab.</p>" + contact;
    return (terms.length ? "<h3>Glossary</h3>" + termList(terms) : "") + (tools.length ? "<h3>Tools</h3>" + tools.map(toolRow).join("") : "") +
      (faq.length ? "<h3>Questions</h3>" + faq.map(function (f) { return faqRow(f, true); }).join("") : "");
  }
  function draw() {
    var text = q.value.trim();
    body.innerHTML = text ? found(text) : view();
    body.scrollTop = 0;
    [].forEach.call(dlg.querySelectorAll("[data-tab]"), function (b) { b.setAttribute("aria-selected", String(!text && b.getAttribute("data-tab") === tab)); });
  }
  function make() {
    dlg = document.createElement("dialog");
    dlg.id = "adqHelp";
    dlg.setAttribute("aria-labelledby", "adqT");
    dlg.innerHTML = '<div class="adqIn"><div class="adqTop"><div class="adqHd"><h2 id="adqT">Help</h2><button class="adqX" type="button" data-close-help aria-label="Close help">×</button></div>' +
      '<input class="adqQ" id="adqQ" type="search" placeholder="Search help, for example: contour, CAO, print" aria-label="Search help" autocomplete="off">' +
      '<div class="adqTabs" role="tablist" aria-label="Help sections">' + TABS.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="false">' + t[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="adqBody" id="adqBody" tabindex="0" role="tabpanel" aria-label="Help text"></div></div>';
    document.body.appendChild(dlg);
    body = dlg.querySelector("#adqBody");
    q = dlg.querySelector("#adqQ");
    q.addEventListener("input", draw);
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) return close();
      var b = e.target.closest("button,a");
      if (!b) return;
      if (b.hasAttribute("data-close-help")) close();
      else if (b.hasAttribute("data-tab")) { tab = b.getAttribute("data-tab"); q.value = ""; draw(); }
      else if (b.hasAttribute("data-tour")) { close(); tour(0); }
      else if (b.hasAttribute("data-show")) { close(); show(b.getAttribute("data-show")); }
      else if (b.tagName === "A" && b.hash && b.pathname === location.pathname) close();
    });
  }
  function open(t) {
    endTour();
    if (!dlg) make();
    if (t) tab = t;
    q.value = "";
    draw();
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
    body.focus({ preventScroll: true });
  }
  function close() { if (dlg && dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); } }

  /* ---------- show me and tour (Cargo Builder only) ---------- */
  var spot, tourEl, spotTimer;
  function $(id) { return document.getElementById(id); }
  function press(id) { window.adqHelpClick = true; try { $(id).click(); } finally { window.adqHelpClick = false; } }
  function visible(el) { return !!el && el.getBoundingClientRect().height > 4; }
  var NEEDS_CARGO = ["strip", "iso", "hand", "rec", "printuld", "load"]; /* shown without cargo too, but empty */
  function clearSpot() { clearTimeout(spotTimer); if (spot) spot.classList.remove("adqSpot"); spot = null; }
  function toolOf(key) { return TOOLS.filter(function (t) { return t[0] === key; })[0]; }
  /* opens the place where the tool lives; returns true when the tool itself can be seen */
  function reveal(t) {
    clearSpot();
    var where = " " + t[5] + " ";
    if (where.indexOf(" 1 ") >= 0 && $("p1").hidden) press("st1");
    if (where.indexOf(" 2 ") >= 0 && $("p2").hidden) press("st2");
    if (where.indexOf(" more ") >= 0 && $("moreTools").hidden) press("toolsBtn");
    var el = document.querySelector(t[4]);
    if (where.indexOf(" rules ") >= 0 && el) el.open = true;
    var ok = visible(el) && !(NEEDS_CARGO.indexOf(t[0]) >= 0 && $("toLoad").disabled);
    if (!ok) { if ($("p1").hidden) press("st1"); el = $("sampleBtn"); }
    spot = el;
    el.classList.add("adqSpot");
    el.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" });
    return ok;
  }
  function card(title, text, count, buttons) {
    if (!tourEl) { tourEl = document.createElement("div"); tourEl.id = "adqTour"; tourEl.setAttribute("role", "dialog"); tourEl.setAttribute("aria-live", "polite"); tourEl.setAttribute("aria-label", "Help"); document.body.appendChild(tourEl); }
    tourEl.innerHTML = "<b>" + esc(title) + "</b><p>" + esc(text) + '</p><div class="r"><span>' + esc(count) + "</span>" + buttons + "</div>";
    var first = tourEl.querySelector(".pri") || tourEl.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  }
  function need(ok) { return ok ? "" : " It works after you add cargo: press Try sample cargo, marked in yellow."; }
  function show(key) {
    var t = toolOf(key);
    if (!t) return;
    var ok = reveal(t);
    card(t[2], t[3] + need(ok), "", '<button class="adqB" type="button" data-back-help>Back to help</button><button class="adqB pri" type="button" data-end>Got it</button>');
  }
  var TOUR = ["aircraft", "add", "import", "sample", "strip", "iso", "load", "side", "checks", "print"];
  var step = 0;
  function tour(i) {
    step = Math.max(0, Math.min(TOUR.length - 1, i));
    var t = toolOf(TOUR[step]), ok = reveal(t), last = step === TOUR.length - 1;
    card(t[2], t[3] + need(ok), step + 1 + " of " + TOUR.length,
      '<button class="adqB" type="button" data-end>Stop</button>' + (step ? '<button class="adqB" type="button" data-step="-1">Back</button>' : "") +
      '<button class="adqB pri" type="button" ' + (last ? "data-end>Finish" : 'data-step="1">Next') + "</button>");
  }
  function endTour() { clearSpot(); if (tourEl) { tourEl.remove(); tourEl = null; } }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-help],[data-end],[data-step],[data-back-help]");
    if (!b) return;
    if (b.hasAttribute("data-help")) { e.preventDefault(); open(b.getAttribute("data-help") || "start"); }
    else if (b.hasAttribute("data-end")) endTour();
    else if (b.hasAttribute("data-step")) tour(step + Number(b.getAttribute("data-step")));
    else { open(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && tourEl && !(dlg && dlg.open)) return endTour();
    if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector("dialog[open]")) return;
    e.preventDefault();
    open("start");
  });

  /* a small floating button while the one in the header is out of sight */
  var head = document.querySelector("button[data-help]");
  if (head && "IntersectionObserver" in window) {
    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "adqh adqFab";
    fab.setAttribute("data-help", "");
    fab.hidden = true;
    fab.style.display = "none";
    fab.innerHTML = '<i aria-hidden="true">?</i>Help';
    document.body.appendChild(fab);
    new IntersectionObserver(function (en) { var off = !en[en.length - 1].isIntersecting; fab.hidden = !off; fab.style.display = off ? "" : "none"; }).observe(head);
  }

  /* links such as /build?help=tour, /build?help=dg or /?help=glossary */
  var want = (/[?&]help=([a-z]+)/.exec(location.search) || [])[1];
  if (want) setTimeout(function () {
    if (TABS.some(function (t) { return t[0] === want; })) open(want);
    else if (ON_BUILD && want === "tour") tour(0);
    else if (ON_BUILD && toolOf(want)) show(want);
    else open("start");
  }, 300);
})();
