"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Aircraft & ULD Database ─────────────────────────────────────────────────
const AIRCRAFT: Record<string, {
  label: string; name: string; type: string;
  main: { uld: ULDSpec; positions: string[]; maxPayload: number; door: Door } | null;
  lower: { uld: ULDSpec; positions: string[]; maxPayload: number; door: Door } | null;
}> = {
  B777F: {
    label: "B777F", name: "Boeing 777 Freighter", type: "freighter",
    main:  { uld: { id:"PMC", l:318,w:244,h:244,maxWt:6804 }, positions:["P1","P2","P3","P4","P5","P6","P7","P8","P9","P10","P11"], maxPayload:75000, door:{w:305,h:261} },
    lower: { uld: { id:"LD3", l:153,w:156,h:163,maxWt:1588 }, positions:["FWD1","FWD2","FWD3","FWD4","FWD5","FWD6","FWD7","AFT1","AFT2","AFT3","AFT4","AFT5","AFT6","AFT7"], maxPayload:28000, door:{w:183,h:170} },
  },
  "B787-8": {
    label: "B787-8", name: "Boeing 787-8", type: "pax",
    main:  null,
    lower: { uld: { id:"AKE", l:153,w:156,h:163,maxWt:1588 }, positions:["FWD1","FWD2","FWD3","FWD4","AFT1","AFT2","AFT3","AFT4"], maxPayload:14000, door:{w:175,h:127} },
  },
  "B767-300": {
    label: "B767-300", name: "Boeing 767-300ER", type: "pax",
    main:  null,
    lower: { uld: { id:"LD2", l:119,w:153,h:119,maxWt:1225 }, positions:["FWD1","FWD2","FWD3","FWD4","FWD5","AFT1","AFT2","AFT3","AFT4","AFT5"], maxPayload:11000, door:{w:178,h:122} },
  },
  "B737-800": {
    label: "B737-800", name: "Boeing 737-800", type: "pax",
    main:  null,
    lower: { uld: { id:"Bulk", l:250,w:120,h:100,maxWt:1497 }, positions:["FWD","AFT"], maxPayload:4000, door:{w:118,h:86} },
  },
  "A350-900": {
    label: "A350-900", name: "Airbus A350-900", type: "pax",
    main:  null,
    lower: { uld: { id:"AKE", l:153,w:156,h:163,maxWt:1588 }, positions:["FWD1","FWD2","FWD3","FWD4","FWD5","AFT1","AFT2","AFT3","AFT4","AFT5"], maxPayload:15000, door:{w:182,h:174} },
  },
};

const DIM_DIV = 6000;
const COLORS = ["#EAB308","#22c55e","#60a5fa","#f97316","#a78bfa","#f43f5e","#14b8a6","#fb923c","#818cf8","#34d399"];
const PAL_COLORS = ["#EAB308","#22c55e","#60a5fa","#f97316","#a78bfa"];

// ─── Types ───────────────────────────────────────────────────────────────────
interface ULDSpec  { id: string; l: number; w: number; h: number; maxWt: number; }
interface Door     { w: number; h: number; }
interface Shipment { id: number; desc: string; l: number; w: number; h: number; wt: number; pcs: number; color: string; }
interface PlacedBox extends Shipment { piece: number; px: number; py: number; pz: number; bl: number; bh: number; bw: number; overhang: boolean; ovCm: number; }
interface Pallet   { posId: string; deck: string; spec: ULDSpec; placed: PlacedBox[]; util: number; totalWt: number; hasOH: boolean; color: string; isOverflow: boolean; }
interface LoadResult { main: Pallet[]; lower: Pallet[]; unplaced: PlacedBox[]; }

// ─── Bin-packing ─────────────────────────────────────────────────────────────
function packBin(boxes: (Shipment & { piece: number })[], spec: ULDSpec, useOH: boolean) {
  const effL = spec.l * (useOH ? 1.25 : 1);
  const effW = spec.w * (useOH ? 1.10 : 1);
  const spaces = [{ x:0, y:0, z:0, lx:effL, ly:spec.h, lz:effW }];
  const placed: PlacedBox[] = [];
  const rem:    typeof boxes = [];

  for (const box of boxes) {
    let best: { bl:number; bh:number; bw:number } | null = null;
    let bestSi = -1;
    for (let si = 0; si < spaces.length; si++) {
      const sp = spaces[si];
      const rots: [number,number,number][] = [[box.l,box.h,box.w],[box.w,box.h,box.l],[box.l,box.w,box.h],[box.w,box.l,box.h],[box.h,box.l,box.w],[box.h,box.w,box.l]];
      for (const [bl,bh,bw] of rots) {
        if (bl <= sp.lx && bh <= sp.ly && bw <= sp.lz) { best = {bl,bh,bw}; bestSi = si; break; }
      }
      if (best) break;
    }
    if (best) {
      const { bl,bh,bw } = best;
      const sp = spaces[bestSi];
      const ovL = Math.max(0, sp.x + bl - spec.l);
      const ovW = Math.max(0, sp.z + bw - spec.w);
      placed.push({ ...box, px:sp.x, py:sp.y, pz:sp.z, bl, bh, bw, overhang: ovL>0||ovW>0, ovCm: Math.round(Math.max(ovL,ovW)) });
      const ns = [
        { x:sp.x+bl, y:sp.y,    z:sp.z,    lx:sp.lx-bl, ly:sp.ly,    lz:sp.lz    },
        { x:sp.x,    y:sp.y+bh, z:sp.z,    lx:bl,        ly:sp.ly-bh, lz:sp.lz    },
        { x:sp.x,    y:sp.y,    z:sp.z+bw, lx:bl,        ly:bh,        lz:sp.lz-bw },
      ].filter(s => s.lx > 2 && s.ly > 2 && s.lz > 2);
      spaces.splice(bestSi, 1, ...ns);
      spaces.sort((a,b) => (a.y-b.y) || (a.x-b.x) || (a.z-b.z));
    } else {
      rem.push(box);
    }
  }
  return { placed, rem };
}

function runOptimize(shipments: Shipment[], selAC: string, ohAllowed: boolean): LoadResult {
  const ac = AIRCRAFT[selAC];
  let boxes: (Shipment & { piece: number })[] = [];
  for (const s of shipments) for (let i = 0; i < s.pcs; i++) boxes.push({ ...s, piece: i+1 });
  boxes.sort((a,b) => (b.l*b.w*b.h) - (a.l*a.w*a.h));

  const res: LoadResult = { main:[], lower:[], unplaced:[] };
  let rem = [...boxes];

  if (ac.type === "freighter" && ac.main) {
    const spec = ac.main.uld;
    for (let i = 0; i < ac.main.positions.length && rem.length; i++) {
      const { placed, rem: r } = packBin(rem, spec, ohAllowed);
      if (!placed.length) break;
      const vol = placed.reduce((s,b) => s+b.bl*b.bh*b.bw, 0);
      res.main.push({ posId: ac.main.positions[i], deck:"main", spec, placed, util: Math.round(vol/(spec.l*spec.h*spec.w)*100), totalWt: placed.reduce((s,b)=>s+b.wt,0), hasOH: placed.some(b=>b.overhang), color: PAL_COLORS[res.main.length % PAL_COLORS.length], isOverflow: false });
      rem = r;
    }
  }
  if (ac.lower) {
    const spec = ac.lower.uld;
    for (let i = 0; i < ac.lower.positions.length && rem.length; i++) {
      const { placed, rem: r } = packBin(rem, spec, false);
      if (!placed.length) break;
      const vol = placed.reduce((s,b) => s+b.bl*b.bh*b.bw, 0);
      const palIdx = res.main.length + res.lower.length;
      res.lower.push({ posId: ac.lower.positions[i], deck:"lower", spec, placed, util: Math.round(vol/(spec.l*spec.h*spec.w)*100), totalWt: placed.reduce((s,b)=>s+b.wt,0), hasOH: false, color: PAL_COLORS[palIdx % PAL_COLORS.length], isOverflow: false });
      rem = r;
    }
  }
  res.unplaced = rem;
  return res;
}

// ─── Three.js renderer hook ──────────────────────────────────────────────────
function useThreeRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  pallet: Pallet | null
) {
  const isDrag = useRef(false);
  const prev   = useRef({ x:0, y:0 });
  const rot    = useRef({ x:0.4, y:0.5 });
  const zoom   = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let THREE: typeof import("three");
    let renderer: import("three").WebGLRenderer;
    let scene:    import("three").Scene;
    let camera:   import("three").PerspectiveCamera;
    let animId:   number;

    function updateCam(spec: ULDSpec) {
      if (!camera || !renderer || !scene) return;
      const md = Math.max(spec.l, spec.w, spec.h);
      const r  = md * 1.8 * zoom.current;
      camera.position.set(
        spec.l/2 + r * Math.sin(rot.current.y) * Math.cos(rot.current.x),
        spec.h/2 + r * Math.sin(rot.current.x),
        spec.w/2 + r * Math.cos(rot.current.y) * Math.cos(rot.current.x),
      );
      camera.lookAt(spec.l/2, spec.h/2, spec.w/2);
      renderer.render(scene, camera);
    }

    import("three").then(mod => {
      THREE = mod;
      const W = canvas.offsetWidth  || 600;
      const H = canvas.offsetHeight || 340;

      scene    = new THREE.Scene();
      camera   = new THREE.PerspectiveCamera(45, W/H, 1, 3000);
      renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      const dl = new THREE.DirectionalLight(0xffffff, 0.9);

      if (!pallet) {
        // Empty state — just draw axes hint
        renderer.render(scene, camera);
        return;
      }

      const spec = pallet.spec;
      const md   = Math.max(spec.l, spec.w, spec.h);
      dl.position.set(md*2, md*2, md*2); scene.add(dl);
      const dl2 = new THREE.DirectionalLight(0xffffff, 0.35);
      dl2.position.set(-md, -md/2, -md); scene.add(dl2);

      // ULD wireframe
      const palCol = parseInt(pallet.color.replace("#",""), 16);
      const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(spec.l, spec.h, spec.w));
      const ln = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color:palCol, transparent:true, opacity:0.3 }));
      ln.position.set(spec.l/2, spec.h/2, spec.w/2); scene.add(ln);

      // Floor plane
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.l, spec.w),
        new THREE.MeshBasicMaterial({ color:palCol, transparent:true, opacity:0.05, side:THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI/2; floor.position.set(spec.l/2, 0, spec.w/2); scene.add(floor);

      // Cargo boxes
      for (const b of pallet.placed) {
        const col = parseInt(b.color.replace("#",""), 16);
        const isOH = b.overhang;
        const geo  = new THREE.BoxGeometry(b.bl-1, b.bh-1, b.bw-1);
        const mat  = new THREE.MeshLambertMaterial({ color: isOH ? 0xEAB308 : col, transparent:true, opacity:0.83 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(b.px+b.bl/2, b.py+b.bh/2, b.pz+b.bw/2); scene.add(mesh);
        const eg2  = new THREE.EdgesGeometry(geo);
        const ln2  = new THREE.LineSegments(eg2, new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.25 }));
        ln2.position.copy(mesh.position); scene.add(ln2);
        if (isOH) {
          const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(1,0,0).normalize(),
            new THREE.Vector3(b.px+b.bl, b.py+b.bh/2, b.pz+b.bw/2),
            20, 0xEAB308, 0.15*20, 0.08*20
          );
          scene.add(arrow);
        }
      }

      rot.current  = { x:0.4, y:0.5 };
      zoom.current = 1;
      updateCam(spec);

      // Mouse controls
      const onDown  = (e: MouseEvent) => { isDrag.current=true; prev.current={x:e.clientX,y:e.clientY}; };
      const onUp    = ()              => { isDrag.current=false; };
      const onMove  = (e: MouseEvent) => {
        if (!isDrag.current) return;
        rot.current.y += (e.clientX-prev.current.x)*0.009;
        rot.current.x  = Math.max(-1.2, Math.min(1.2, rot.current.x-(e.clientY-prev.current.y)*0.009));
        prev.current   = {x:e.clientX,y:e.clientY};
        updateCam(pallet.spec);
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        zoom.current = Math.max(0.4, Math.min(2.5, zoom.current+(e.deltaY>0?0.1:-0.1)));
        updateCam(pallet.spec);
      };
      const onTDown  = (e: TouchEvent) => { isDrag.current=true; prev.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; };
      const onTMove  = (e: TouchEvent) => {
        if (!isDrag.current) return;
        rot.current.y += (e.touches[0].clientX-prev.current.x)*0.009;
        rot.current.x  = Math.max(-1.2, Math.min(1.2, rot.current.x-(e.touches[0].clientY-prev.current.y)*0.009));
        prev.current   = {x:e.touches[0].clientX,y:e.touches[0].clientY};
        updateCam(pallet.spec);
      };

      canvas.addEventListener("mousedown",  onDown);
      canvas.addEventListener("mouseup",    onUp);
      canvas.addEventListener("mouseleave", onUp);
      canvas.addEventListener("mousemove",  onMove);
      canvas.addEventListener("wheel",      onWheel, { passive:false });
      canvas.addEventListener("touchstart", onTDown);
      canvas.addEventListener("touchend",   onUp);
      canvas.addEventListener("touchmove",  onTMove);

      return () => {
        canvas.removeEventListener("mousedown",  onDown);
        canvas.removeEventListener("mouseup",    onUp);
        canvas.removeEventListener("mouseleave", onUp);
        canvas.removeEventListener("mousemove",  onMove);
        canvas.removeEventListener("wheel",      onWheel);
        canvas.removeEventListener("touchstart", onTDown);
        canvas.removeEventListener("touchend",   onUp);
        canvas.removeEventListener("touchmove",  onTMove);
      };
    });

    return () => {
      if (animId) cancelAnimationFrame(animId);
      renderer?.dispose();
    };
  }, [pallet]);
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function OptimizerPage() {
  const [selAC,        setSelAC]        = useState("B777F");
  const [ohAllowed,    setOhAllowed]    = useState(true);
  const [activeTab,    setActiveTab]    = useState<"excel"|"manual">("excel");
  const [shipments,    setShipments]    = useState<Shipment[]>([]);
  const [loadResult,   setLoadResult]   = useState<LoadResult | null>(null);
  const [activePal,    setActivePal]    = useState(0);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Manual form
  const [form, setForm] = useState({ desc:"", l:"", w:"", h:"", wt:"", pcs:"1" });

  // Excel
  const [upStatus,    setUpStatus]   = useState<{type:"info"|"ok"|"err"; msg:string}>({ type:"info", msg:"No file loaded" });
  const [parsedRows,  setParsedRows] = useState<string[][]>([]);
  const [fileHeaders, setHeaders]    = useState<string[]>([]);
  const [showMap,     setShowMap]    = useState(false);
  const [colMap,      setColMap]     = useState<Record<string,string>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const allPallets: Pallet[] = loadResult ? [...loadResult.main, ...loadResult.lower] : [];
  const activePallet = allPallets[activePal] ?? null;

  useThreeRenderer(canvasRef, activePallet);

  // ── KPIs ──
  const totalWt  = shipments.reduce((s,sh) => s+sh.wt*sh.pcs, 0);
  const dimWt    = shipments.reduce((s,sh) => s+(sh.l*sh.w*sh.h)/DIM_DIV*sh.pcs, 0);
  const chargeWt = Math.max(totalWt, dimWt);
  const avgUtil  = allPallets.length ? Math.round(allPallets.reduce((s,p)=>s+p.util,0)/allPallets.length) : 0;

  // ── Optimization ──
  const optimize = useCallback(() => {
    if (!shipments.length) { alert("Add at least one shipment."); return; }
    setIsOptimizing(true);
    setTimeout(() => {
      const result = runOptimize(shipments, selAC, ohAllowed);
      setLoadResult(result);
      setActivePal(0);
      setIsOptimizing(false);
    }, 50);
  }, [shipments, selAC, ohAllowed]);

  // ── Manual entry ──
  const addManual = () => {
    const l=parseFloat(form.l), w=parseFloat(form.w), h=parseFloat(form.h), wt=parseFloat(form.wt), pcs=parseInt(form.pcs)||1;
    if (!l||!w||!h||!wt) { alert("Enter all dimensions and weight."); return; }
    const s: Shipment = { id: Date.now()+Math.random(), desc: form.desc||"Cargo item", l, w, h, wt, pcs, color: COLORS[shipments.length%COLORS.length] };
    setShipments(prev => [...prev, s]);
    setForm({ desc:"", l:"", w:"", h:"", wt:"", pcs:"1" });
  };

  // ── Excel upload ──
  const handleFile = async (file: File) => {
    if (!file) return;
    const XLSX = await import("xlsx");
    const ext  = file.name.split(".").pop()?.toLowerCase();
    const ab   = await file.arrayBuffer();
    const wb   = XLSX.read(new Uint8Array(ab), { type:"array" });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<string[]>(ws, { header:1, defval:"" });
    if (json.length < 2) { setUpStatus({type:"err", msg:"File appears empty"}); return; }
    const hdrs = (json[0] as string[]).map(h => String(h));
    const rows = json.slice(1).filter((r:string[]) => r.some(c => c !== "")) as string[][];
    setHeaders(hdrs); setParsedRows(rows);
    // Auto-map
    const ALIASES: Record<string,string[]> = {
      desc:["description","awb","awb number","name","item","cargo","shipment"],
      l:   ["length","l","len","l(cm)","length(cm)"],
      w:   ["width","w","wid","w(cm)","width(cm)"],
      h:   ["height","h","hgt","h(cm)","height(cm)"],
      wt:  ["weight","wt","kg","weight(kg)","gross weight","actual weight"],
      pcs: ["pieces","pcs","qty","quantity"],
    };
    const auto: Record<string,string> = {};
    for (const [key, aliases] of Object.entries(ALIASES)) {
      const found = hdrs.find(h => aliases.includes(h.toLowerCase().trim()));
      if (found) auto[key] = found;
    }
    setColMap(auto); setShowMap(true);
    setUpStatus({ type:"ok", msg:`${rows.length} rows from "${file.name}"` });
  };

  const importExcel = () => {
    if (!colMap.l||!colMap.w||!colMap.h||!colMap.wt) { setUpStatus({type:"err",msg:"Map L, W, H and Weight first"}); return; }
    let imp = 0, skip = 0;
    const newShips: Shipment[] = [];
    for (let ri = 0; ri < parsedRows.length; ri++) {
      const row = parsedRows[ri];
      const v   = (col:string) => col ? row[fileHeaders.indexOf(col)] : "";
      const l=parseFloat(v(colMap.l)), w=parseFloat(v(colMap.w)), h=parseFloat(v(colMap.h)), wt=parseFloat(v(colMap.wt));
      if (!l||!w||!h||!wt) { skip++; continue; }
      newShips.push({ id: Date.now()+Math.random(), desc: String(v(colMap.desc)||`Row ${ri+2}`), l, w, h, wt, pcs: parseInt(v(colMap.pcs))||1, color: COLORS[(shipments.length+newShips.length)%COLORS.length] });
      imp++;
    }
    setShipments(prev => [...prev, ...newShips]);
    setUpStatus({ type:"ok", msg:`${imp} imported${skip ? ` (${skip} skipped)` : ""}` });
    setShowMap(false);
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb   = XLSX.utils.book_new();
    const data  = [
      ["AWB Number","Description","Length (cm)","Width (cm)","Height (cm)","Weight (kg)","Pieces"],
      ["071-10001","Fresh flowers","80","60","50","40","2"],
      ["071-10002","Auto parts","120","100","80","180","1"],
      ["071-10003","Pharma","60","50","40","25","3"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Manifest");
    XLSX.writeFile(wb, "AdeyIQ_Manifest_Template.xlsx");
  };

  const exportCSV = () => {
    if (!loadResult) return;
    let csv = "Deck,Position,ULD,AWB/Desc,Pcs,Actual Wt,DIM Wt,Chargeable,Pos-L,Pos-W,Pos-H,Overhang\n";
    for (const pallet of allPallets) {
      const grps: Record<number, PlacedBox[]> = {};
      for (const b of pallet.placed) { if (!grps[b.id]) grps[b.id]=[]; grps[b.id].push(b); }
      for (const grp of Object.values(grps)) {
        const b  = grp[0];
        const aw = +(b.wt*grp.length).toFixed(1);
        const dw = +((b.l*b.w*b.h)/DIM_DIV*grp.length).toFixed(1);
        csv += `${pallet.deck},${pallet.posId},${pallet.spec.id},"${b.desc}",${grp.length},${aw},${dw},${+(Math.max(aw,dw)).toFixed(1)},${Math.round(grp[0].px)},${Math.round(grp[0].pz)},${Math.round(grp[0].py)},${grp.some(x=>x.overhang)?"Yes":"No"}\n`;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv" }));
    a.download = `AdeyIQ_LoadPlan_${selAC}.csv`; a.click();
  };

  const utilColor = (p: number) => p >= 90 ? "text-green-400" : p >= 70 ? "text-yellow-400" : "text-orange-400";

  const FIELD_DEFS = [
    { key:"desc", label:"AWB / Description" },
    { key:"l",    label:"Length (cm)"       },
    { key:"w",    label:"Width (cm)"        },
    { key:"h",    label:"Height (cm)"       },
    { key:"wt",   label:"Weight (kg)"       },
    { key:"pcs",  label:"Pieces"            },
  ];

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#111111] text-white">

      {/* ── Page header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-white/[0.07]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Cargo Load Optimizer</h1>
            <p className="text-gray-500 text-sm mt-1">
              Aircraft contour limits · door constraints · multi-pallet overflow · overhang support
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ohAllowed}
                onChange={e => setOhAllowed(e.target.checked)}
                className="w-4 h-4 accent-yellow-400"
              />
              Allow overhang <span className="text-gray-600 text-xs">(IATA ≤25%)</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-5 p-6 min-h-[calc(100vh-100px)]">

        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════ */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">

          {/* Aircraft selector */}
          <div className="bg-[#1b1b1b] rounded-2xl border border-white/[0.08] overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-4 pt-4 pb-3">
              Select aircraft type
            </p>
            <div className="px-3 pb-4 grid grid-cols-2 gap-2">
              {Object.entries(AIRCRAFT).map(([key, ac]) => (
                <button
                  key={key}
                  onClick={() => { setSelAC(key); setLoadResult(null); }}
                  className={`rounded-xl border p-3 text-left transition-all duration-150 ${
                    selAC === key
                      ? "border-yellow-400/60 bg-yellow-400/10"
                      : "border-white/[0.08] bg-[#222] hover:border-white/20"
                  }`}
                >
                  <div className="text-lg mb-1">✈</div>
                  <div className={`text-xs font-bold ${selAC===key ? "text-yellow-400" : "text-gray-300"}`}>
                    {ac.label}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {ac.type === "freighter" ? "Freighter" : "Passenger"}
                  </div>
                  {selAC === key && ac.main && (
                    <div className="mt-2 text-[9px] text-yellow-400/70 space-y-0.5">
                      <div>Main: {ac.main.positions.length} pos · {ac.main.uld.id}</div>
                      <div>Lower: {ac.lower?.positions.length} pos · {ac.lower?.uld.id}</div>
                    </div>
                  )}
                  {selAC === key && !ac.main && ac.lower && (
                    <div className="mt-2 text-[9px] text-yellow-400/70">
                      Lower: {ac.lower.positions.length} pos · {ac.lower.uld.id}
                    </div>
                  )}
                </button>
              ))}
            </div>
            {/* Door info strip */}
            {(() => {
              const ac = AIRCRAFT[selAC];
              const door = ac.main?.door ?? ac.lower?.door;
              const payload = ac.main?.maxPayload ?? ac.lower?.maxPayload ?? 0;
              if (!door) return null;
              return (
                <div className="border-t border-white/[0.07] px-4 py-3 flex justify-between text-[11px]">
                  <span className="text-gray-600">Cargo door: <span className="text-gray-400">{door.w}×{door.h} cm</span></span>
                  <span className="text-gray-600">Max payload: <span className="text-yellow-400 font-semibold">{(payload/1000).toFixed(0)}T</span></span>
                </div>
              );
            })()}
          </div>

          {/* Input panel */}
          <div className="bg-[#1b1b1b] rounded-2xl border border-white/[0.08] overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/[0.07]">
              {(["excel","manual"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    activeTab === tab
                      ? "text-yellow-400 border-b-2 border-yellow-400 bg-yellow-400/[0.04]"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab === "excel" ? "📊 Excel" : "✏ Manual"}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* ── Excel tab ── */}
              {activeTab === "excel" && (
                <div className="space-y-3">
                  {/* Drop zone */}
                  <label className="block border border-dashed border-white/20 hover:border-yellow-400/50 rounded-xl p-5 text-center cursor-pointer transition-colors group">
                    <input
                      type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                      onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                    />
                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📂</div>
                    <p className="text-sm font-semibold text-gray-300">Drop Excel / CSV here</p>
                    <p className="text-xs text-gray-600 mt-1">or click to browse</p>
                  </label>

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      upStatus.type==="ok"  ? "bg-green-400/10 text-green-400" :
                      upStatus.type==="err" ? "bg-red-400/10   text-red-400"   :
                                              "bg-blue-400/10  text-blue-400"
                    }`}>
                      {upStatus.msg}
                    </span>
                    <button onClick={downloadTemplate} className="text-[11px] text-yellow-400 underline underline-offset-2 hover:text-yellow-300">
                      ⬇ Template
                    </button>
                  </div>

                  {/* Column map */}
                  {showMap && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                        Map columns <span className="text-yellow-400">({fileHeaders.length} detected)</span>
                      </p>
                      {FIELD_DEFS.map(f => (
                        <div key={f.key} className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-500 w-24 flex-shrink-0">{f.label}</span>
                          <select
                            value={colMap[f.key]||""}
                            onChange={e => setColMap(p => ({...p,[f.key]:e.target.value}))}
                            className="flex-1 bg-[#222] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-gray-300 outline-none"
                          >
                            <option value="">— skip —</option>
                            {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                      <button onClick={importExcel} className="w-full bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-xs font-semibold rounded-xl py-2 mt-1 transition-colors">
                        ⬆ Import to manifest
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Manual tab ── */}
              {activeTab === "manual" && (
                <div className="space-y-2">
                  <input
                    placeholder="AWB / description"
                    value={form.desc}
                    onChange={e => setForm(p => ({...p,desc:e.target.value}))}
                    className="w-full bg-[#222] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none placeholder-gray-600 focus:border-yellow-400/40"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {(["l","w","h"] as const).map(key => (
                      <input
                        key={key}
                        type="number" placeholder={key.toUpperCase()+" (cm)"}
                        value={form[key]}
                        onChange={e => setForm(p => ({...p,[key]:e.target.value}))}
                        className="bg-[#222] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none placeholder-gray-600 focus:border-yellow-400/40 w-full"
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Weight (kg)" value={form.wt}  onChange={e => setForm(p=>({...p,wt:e.target.value}))}  className="bg-[#222] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none placeholder-gray-600 focus:border-yellow-400/40 w-full" />
                    <input type="number" placeholder="Pieces"      value={form.pcs} onChange={e => setForm(p=>({...p,pcs:e.target.value}))} className="bg-[#222] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none placeholder-gray-600 focus:border-yellow-400/40 w-full" />
                  </div>
                  <button onClick={addManual} className="w-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-300 text-sm font-medium rounded-xl py-2 transition-colors">
                    + Add to manifest
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Manifest */}
          <div className="bg-[#1b1b1b] rounded-2xl border border-white/[0.08] flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Manifest{" "}
                <span className="text-yellow-400">{shipments.length} items</span>
              </span>
              {shipments.length > 0 && (
                <button onClick={() => { setShipments([]); setLoadResult(null); }} className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {shipments.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-6">No shipments added</p>
              ) : (
                shipments.map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-[#222] rounded-xl px-3 py-2">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background:s.color }} />
                    <span className="flex-1 text-xs text-gray-400 truncate">{s.desc} — {s.l}×{s.w}×{s.h}cm {s.wt}kg ×{s.pcs}</span>
                    <button onClick={() => setShipments(p => p.filter(x => x.id!==s.id))} className="text-gray-700 hover:text-red-400 text-base leading-none transition-colors flex-shrink-0">×</button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-white/[0.07]">
              <button
                onClick={optimize}
                disabled={isOptimizing || shipments.length===0}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  isOptimizing || shipments.length===0
                    ? "bg-[#222] text-gray-600 cursor-not-allowed"
                    : "bg-yellow-400 text-black hover:bg-yellow-300 active:scale-[0.98]"
                }`}
              >
                {isOptimizing ? (
                  <><span className="animate-spin">⟳</span> Optimizing…</>
                ) : (
                  <><span>▶</span> Run optimization</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* 3D Load Plan panel */}
          <div className="bg-[#1b1b1b] rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.07] flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">3D Load Plan</p>
              {loadResult && (
                <div className="flex items-center gap-2">
                  {allPallets.map((p, i) => (
                    <button
                      key={p.posId}
                      onClick={() => setActivePal(i)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                        i === activePal
                          ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
                          : "border-white/10 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-sm" style={{ background:p.color }} />
                      {p.posId}
                      <span className="opacity-60">{p.util}%</span>
                    </button>
                  ))}
                  {loadResult.unplaced.length > 0 && (
                    <span className="text-[11px] text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                      {loadResult.unplaced.length} unloaded
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Canvas */}
            <div className="relative bg-[#151515]" style={{ height:"340px" }}>
              <canvas ref={canvasRef} className="w-full h-full" />
              {!loadResult && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-700 text-sm">Add shipments and run optimization to see 3D load plan</p>
                </div>
              )}
              <p className="absolute bottom-3 right-4 text-[11px] text-gray-700">
                drag · scroll to zoom
              </p>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-4 divide-x divide-white/[0.07] border-t border-white/[0.07]">
              {[
                { label:"Aircraft",      value: selAC                                                                },
                { label:"ULDs used",     value: allPallets.length > 0 ? String(allPallets.length) : "—"            },
                { label:"Avg utilization", value: allPallets.length > 0 ? `${avgUtil}%` : "—",
                  color: avgUtil>=70 ? "text-green-400" : avgUtil>=50 ? "text-yellow-400" : "text-orange-400"       },
                { label:"Chargeable wt", value: chargeWt > 0 ? `${Math.round(chargeWt)} kg` : "—"                  },
              ].map(kpi => (
                <div key={kpi.label} className="py-4 px-5 text-center">
                  <p className={`text-xl font-bold ${kpi.color ?? "text-yellow-400"}`}>{kpi.value}</p>
                  <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Load plan table */}
          <div className="bg-[#1b1b1b] rounded-2xl border border-white/[0.08] flex-1 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-white/[0.07]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Load plan by pallet</p>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-[#1a1a1a]">
                    {["Pallet","AWB / Description","Pcs","Actual wt","DIM wt","Chargeable","Position","Overhang","Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-600 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap border-b border-white/[0.07]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loadResult ? (
                    <tr>
                      <td colSpan={9} className="text-center text-gray-600 py-12">
                        Select aircraft · add cargo · run optimization
                      </td>
                    </tr>
                  ) : allPallets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-red-400 py-12">
                        No cargo could be placed — try a different aircraft or smaller items
                      </td>
                    </tr>
                  ) : (
                    allPallets.flatMap(pallet => {
                      const grps: Record<number, PlacedBox[]> = {};
                      for (const b of pallet.placed) { if (!grps[b.id]) grps[b.id]=[]; grps[b.id].push(b); }
                      return Object.values(grps).map((grp, gi) => {
                        const b   = grp[0];
                        const aw  = +(b.wt*grp.length).toFixed(1);
                        const dw  = +((b.l*b.w*b.h)/DIM_DIV*grp.length).toFixed(1);
                        const cw  = +(Math.max(aw,dw)).toFixed(1);
                        const oh  = grp.some(x => x.overhang);
                        return (
                          <tr
                            key={`${pallet.posId}-${b.id}-${gi}`}
                            onClick={() => setActivePal(allPallets.indexOf(pallet))}
                            className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm" style={{ background:pallet.color }} />
                                <span className="font-semibold text-gray-300">{pallet.posId}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[160px] truncate text-gray-400">{b.desc}</td>
                            <td className="px-4 py-3 text-gray-500 text-center">{grp.length}</td>
                            <td className="px-4 py-3 text-gray-400 font-mono">{aw} kg</td>
                            <td className="px-4 py-3 text-gray-400 font-mono">{dw} kg</td>
                            <td className={`px-4 py-3 font-semibold font-mono ${cw===aw ? "text-green-400" : "text-yellow-400"}`}>{cw} kg</td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-[10px]">L{Math.round(grp[0].px)}·W{Math.round(grp[0].pz)}·H{Math.round(grp[0].py)}</td>
                            <td className="px-4 py-3">
                              {oh ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400">+{grp[0].ovCm}cm</span>
                              ) : (
                                <span className="text-gray-700">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-400/10 text-green-400">Placed</span>
                            </td>
                          </tr>
                        );
                      });
                    })
                  )}
                  {loadResult?.unplaced && loadResult.unplaced.length > 0 && (
                    <tr className="opacity-60">
                      <td colSpan={9} className="px-4 py-3 text-red-400 text-xs italic">
                        + {loadResult.unplaced.length} piece(s) could not be loaded — exceed all available positions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t border-white/[0.07] flex gap-3">
              <button
                onClick={exportCSV}
                disabled={!loadResult}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border transition-all ${
                  loadResult
                    ? "border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300"
                    : "border-white/5 text-gray-700 cursor-not-allowed"
                }`}
              >
                ⬇ Export CSV
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-yellow-400 text-black hover:bg-yellow-300 active:scale-[0.98] transition-all"
              >
                📄 Generate PDF ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}