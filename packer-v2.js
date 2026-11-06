/* =====================================================================
   AdeyIQ packing engine v2  -  drop-in replacement for packBin()
   ---------------------------------------------------------------------
   Same call and same output as the v3 packBin:
       packBin(boxes, spec, useOH)  ->  { placed, rem, stats }
   Each placed box keeps the v3 fields
       px, py, pz, bl, bh, bw, rot, tilted, overhang, ovCm, balancedExt
   so renderULDView(), the aircraft view, the table and CSV keep working.

   Uses these v3 helpers (already defined in the optimizer page):
       isLD3Spec, ld3UsableWidthAtY, usableLengthAtHeight,
       centeredLengthOffset, fitsContour, MIN_PALLET_SUPPORT

   Axes (same as v3):  x = ULD length (spec.l), y = height, z = width.

   New, optional shipment fields (old data without them still works):
       noStack : true  -> nothing may be placed on top of this piece
       dg      : '3', '5.1', '8' ...  -> DG class for segregation
   ===================================================================== */

const PACK_RULES = {
  minSupport: 0.8,        // share of a box's base that must rest on the floor / other boxes
  heavyOnLightRatio: 2,   // a piece may not sit on a piece less than 1/2 its weight
  useNetWeight: true,     // max payload = spec.maxWt - spec.tare
  // Simplified DG segregation pairs (IATA DGR Table 9.3.A style).
  // Pieces of these classes are never put in the same ULD.
  // !! Check this table against your current IATA DGR edition before production use.
  dgSegregation: [
    ['1', '*'],           // explosives (except 1.4S) apart from all other DG
    ['3', '5.1'],
    ['4.2', '5.1'],
    ['4.3', '8'],
  ],
  // Overhang allowed PER SIDE (cm), only for pieces bigger than the ULD base.
  // Normal pieces always stay inside the base. Containers never overhang.
  // !! Set these from your AHM / WBM per aircraft position before production use.
  overhang: {
    main:  { length: 25, width: 15 },
    lower: { length: 0,  width: 0 },   // LD6/PAJ5 use their own lower-deck build-out
    bulk:  { length: 0,  width: 0 },
  },
  // Centre load: one base pallet on the main-deck centreline, the piece may
  // overhang in length and width up to the edges of 2 adjacent stations
  // (4 PMC positions: e.g. DL+DR+EL+ER), which are then blocked.
  // !! Placeholder values - set from your AHM / WBM before production use.
  centerLoad: {
    bases: ['PMC', 'PGA'],     // base pallets to try, in this order
    minBaseSupport: 0.5,       // share of the piece footprint that must be on the base pallet
    clearance: 5,              // cm kept free from the 4-position envelope edges
  },
};

/* Envelope of a centre load on this aircraft: 2 stations long, L+R wide. */
function centerLoadEnvelope(ac, ulds) {
  if (!ac || !ac.main) return null;
  const pos = ulds[ac.main.uld] || ulds.PMC;
  return {
    l: pos.l * 2,
    w: pos.w * 2,
    h: ac.main.centerH || pos.h,   // centreline height (B777F: 300 cm / 118 in)
  };
}

/* Try to place one piece as a centre load. Returns the built "pallet"
   ({ spec, placed, base }) or null with .reason. Coordinates are inside
   the 4-position envelope (x along the aircraft, z across, 0 = left edge). */
function centerLoadFit(box, ac, ulds) {
  const env = centerLoadEnvelope(ac, ulds);
  if (!env) return { fit: null, reason: 'aircraft has no main deck' };
  const rules = PACK_RULES.centerLoad, c = rules.clearance;
  const orients = [
    { bl: box.l, bh: box.h, bw: box.w, tilted: false, rot: 'LxW' },
    { bl: box.w, bh: box.h, bw: box.l, tilted: false, rot: 'WxL' },
  ];
  if (box.tiltable) orients.push(
    { bl: box.l, bh: box.w, bw: box.h, tilted: true, rot: 'LxH' },
    { bl: box.h, bh: box.w, bw: box.l, tilted: true, rot: 'HxL' });
  let reason = 'bigger than the 4-position centre-load envelope';
  for (const code of rules.bases) {
    const base = ulds[code];
    if (!base || !(ac.mainUlds || []).includes(code)) continue;
    if (base.l > env.l || base.w > env.w) continue;
    const payload = (base.maxWt || Infinity) - (base.tare || 0);
    for (const r of orients) {
      if (r.bl > env.l - 2 * c || r.bw > env.w - 2 * c) continue;
      if (r.bh > env.h) { reason = `${Math.round(r.bh)} cm high > centreline height ${env.h} cm`; continue; }
      if (box.wt > payload) { reason = `${box.wt} kg > ${code} base limit ${payload} kg`; continue; }
      const sup = Math.min(r.bl, base.l) * Math.min(r.bw, base.w) / (r.bl * r.bw);
      if (sup < rules.minBaseSupport) { reason = `only ${Math.round(sup * 100)}% of the piece on a ${code} base`; continue; }
      const bx = (env.l - base.l) / 2, bz = (env.w - base.w) / 2;
      const px = (env.l - r.bl) / 2, pz = (env.w - r.bw) / 2;
      const ovDetail = {
        front: Math.max(0, Math.round(bx - px)), back: Math.max(0, Math.round(px + r.bl - bx - base.l)),
        left: Math.max(0, Math.round(bz - pz)), right: Math.max(0, Math.round(pz + r.bw - bz - base.w)),
      };
      const ovCm = Math.max(ovDetail.front, ovDetail.back, ovDetail.left, ovDetail.right);
      const spec = {
        code: `CTR-${code}`, name: `Centre load on ${code} (4 positions)`, deck: 'main', centerLoad: true,
        l: env.l, w: env.w, h: env.h, tare: base.tare, maxWt: base.maxWt,
        base: { code, l: base.l, w: base.w, x: bx, z: bz },
      };
      const placed = [{ ...box, px, py: 0, pz, bl: r.bl, bh: r.bh, bw: r.bw, rot: r.rot, tilted: r.tilted,
        overhang: ovCm > 0, ovCm, ovDetail, centerLoad: true, balancedExt: false }];
      return { fit: { spec, placed, base: code }, reason: null };
    }
  }
  return { fit: null, reason };
}

/* Pick 2 adjacent stations that both have L and R free, closest to the
   middle of the main deck. Returns the 4 position ids or null. */
function pickCenterLoadPositions(mainPos, usedPos) {
  const stations = [];
  for (const p of mainPos) {
    const m = String(p).toUpperCase().match(/^(.*?)([LR])$/);
    if (!m || !m[1]) continue;
    let s = stations.find(x => x.id === m[1]);
    if (!s) { s = { id: m[1], L: null, R: null }; stations.push(s); }
    s[m[2]] = p;
  }
  const full = s => s.L && s.R && !usedPos.has(s.L) && !usedPos.has(s.R);
  const mid = (stations.length - 1) / 2;
  let best = null;
  for (let i = 0; i + 1 < stations.length; i++) {
    if (!full(stations[i]) || !full(stations[i + 1])) continue;
    const d = Math.abs(i + 0.5 - mid);
    if (!best || d < best.d) best = { d, ids: [stations[i].L, stations[i].R, stations[i + 1].L, stations[i + 1].R] };
  }
  return best ? best.ids : null;
}

/* Can this piece go through a cargo door?  door = { w, h } in cm.
   The piece goes in length-first, so its cross-section (across x high)
   must fit the opening. Non-tiltable pieces must stay upright.
   Returns null if it fits, or a reason string if it does not. */
function doorFitReason(box, door) {
  if (!door) return 'no door data';
  const faces = [[box.w, box.h], [box.l, box.h]];
  if (box.tiltable) faces.push([box.h, box.w], [box.h, box.l], [box.l, box.w], [box.w, box.l]);
  if (faces.some(([across, high]) => across <= door.w && high <= door.h)) return null;
  const minHigh = Math.min(...faces.map(f => f[1]));
  const minAcross = Math.min(...faces.map(f => f[0]));
  if (minHigh > door.h) return `${Math.round(minHigh)} cm high > door ${door.h} cm`;
  if (minAcross > door.w) return `${Math.round(minAcross)} cm wide > door ${door.w} cm`;
  return `does not fit door ${door.w}×${door.h} cm in any allowed orientation`;
}

function overhangLimits(spec) {
  if (isLD3Spec(spec) || spec.profile) return { length: 0, width: 0 };
  return PACK_RULES.overhang[spec.deck] || { length: 0, width: 0 };
}

function dgClassOf(box) {
  if (!box.dg) return null;
  const c = String(box.dg).trim().toUpperCase();
  if (!c || c === '0' || c === 'NO' || c === 'N') return null;
  if (c === '1.4S') return '1.4S';
  return c;
}

function dgConflict(a, b) {
  if (!a || !b) return false;
  const major = c => c.split('.')[0];
  const match = (rule, c) => rule === '*' || rule === c || (!rule.includes('.') && rule === major(c));
  for (const [p, q] of PACK_RULES.dgSegregation) {
    // class 1 rule: 1.4S is exempt, and class 1 vs class 1 is handled by compatibility groups
    if ((p === '1' && (a === '1.4S' || b === '1.4S'))) continue;
    if (p === '1' && major(a) === '1' && major(b) === '1') continue;
    if ((match(p, a) && match(q, b) && a !== b) || (match(p, b) && match(q, a) && a !== b)) return true;
  }
  return false;
}

// Try a few loading orders and keep the best valid build
// (most cargo volume loaded, then most pieces). Every order obeys the same rules.
const PACK_ORDERS = {
  heavyFirst: (a, b) => b.wt - a.wt || vol(b) - vol(a),
  bigFirst:   (a, b) => vol(b) - vol(a) || b.wt - a.wt,
  floorFirst: (a, b) => (b.l * b.w) - (a.l * a.w) || b.wt - a.wt,
};
const vol = b => b.l * b.w * b.h;

function packBin(boxes, spec, useOH) {
  let best = null;
  for (const cmp of Object.values(PACK_ORDERS)) {
    const out = packBinOnce(boxes, spec, useOH, cmp);
    const v = out.placed.reduce((s, b) => s + vol(b), 0);
    if (!best || v > best.v + 1e-6 || (Math.abs(v - best.v) <= 1e-6 && out.placed.length > best.out.placed.length))
      best = { out, v };
  }
  centerBuild(best.out.placed, spec, useOH);
  best.out.stats = buildStats(best.out.placed, spec);
  return best.out;
}

// Slide the whole build (all pieces together, so support is unchanged)
// toward the middle of the ULD floor to bring the centre of gravity in.
function centerBuild(placed, spec, useOH) {
  if (!placed.length) return;
  if (placed.some(p => p.ovDetail)) return;   // oversize pieces are already centred
  const ld3 = isLD3Spec(spec);
  const widthAt = y => (ld3 ? ld3UsableWidthAtY(spec, y) : spec.w) * (useOH ? 1.1 : 1);
  let wt = 0, cx = 0, cz = 0, dxMin = -Infinity, dxMax = Infinity, dzMin = -Infinity, dzMax = Infinity;
  for (const p of placed) {
    wt += p.wt; cx += p.wt * (p.px + p.bl / 2); cz += p.wt * (p.pz + p.bw / 2);
    const off = centeredLengthOffset(spec, p.py, p.bh, useOH, p.bl);
    const effL = usableLengthAtHeight(spec, p.py, p.bh, useOH, p.bl);
    const minPx = Math.max(-off, -p.bl * (1 - MIN_PALLET_SUPPORT));
    const maxPx = Math.min(effL - p.bl - off, spec.l - p.bl * MIN_PALLET_SUPPORT);
    dxMin = Math.max(dxMin, minPx - p.px);
    dxMax = Math.min(dxMax, maxPx - p.px);
    const w = Math.min(widthAt(p.py), widthAt(p.py + p.bh * 0.5), widthAt(Math.min(p.py + p.bh, spec.h)));
    dzMin = Math.max(dzMin, -p.pz);
    dzMax = Math.min(dzMax, w - (p.pz + p.bw));
  }
  const refW = ld3 && spec.profile ? spec.profile.baseW : spec.w;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const dx = clamp(spec.l / 2 - cx / wt, Math.min(0, dxMin), Math.max(0, dxMax));
  const dz = clamp(refW / 2 - cz / wt, Math.min(0, dzMin), Math.max(0, dzMax));
  for (const p of placed) {
    p.px += dx; p.pz += dz;
    p.balancedExt = p.px < -0.5 || p.px + p.bl > spec.l + 0.5;
  }
}

function packBinOnce(boxes, spec, useOH, cmp) {
  const EPS = 0.5;
  const effH = spec.h;
  const ld3 = isLD3Spec(spec);
  const maxWAt = y => (ld3 ? ld3UsableWidthAtY(spec, y) : spec.w) * (useOH ? 1.1 : 1);
  const payloadLimit = spec.maxWt
    ? spec.maxWt - (PACK_RULES.useNetWeight ? (spec.tare || 0) : 0)
    : Infinity;
  const volLimit = spec.l * spec.w * spec.h * (useOH ? 1.4 : 1) *
    (spec.lowerDeckExtension ? spec.lowerDeckExtension.l / spec.l : 1);

  const placed = [], rem = [];
  let loadWt = 0, loadVol = 0;
  const dgInBin = [];

  const ovl = overhangLimits(spec);
  const baseW = ld3 && spec.profile ? spec.profile.baseW : spec.w;

  // Oversize = no orientation fits inside the ULD base. Only these may overhang.
  const oversize = new Map();
  const isOversize = box => {
    if (!oversize.has(box)) oversize.set(box, !rotations(box).some(r => {
      if (r.bh > effH + EPS || r.bw > maxWAt(0) + EPS) return false;
      const [mn, mx] = xRange(0, r.bh, r.bl);
      return mn <= mx + EPS;
    }));
    return oversize.get(box);
  };

  // ---- order: oversize first (centre of the pallet), no-stack last -------
  const order = boxes.map((b, i) => ({ b, i })).sort((A, B) => {
    const a = A.b, b = B.b;
    if (isOversize(a) !== isOversize(b)) return isOversize(a) ? -1 : 1;
    if (!!a.noStack !== !!b.noStack) return a.noStack ? 1 : -1;
    return cmp(a, b) || A.i - B.i;
  }).map(x => x.b);

  // ---- rotations: upright first, tilt only if tiltable ------------------
  function rotations(box) {
    const r = [
      { bl: box.l, bh: box.h, bw: box.w, tilted: false, rot: 'LxW' },
      { bl: box.w, bh: box.h, bw: box.l, tilted: false, rot: 'WxL' },
    ];
    if (box.tiltable) r.push(
      { bl: box.l, bh: box.w, bw: box.h, tilted: true, rot: 'LxH' },
      { bl: box.h, bh: box.w, bw: box.l, tilted: true, rot: 'HxL' },
      { bl: box.w, bh: box.l, bw: box.h, tilted: true, rot: 'WxH' },
      { bl: box.h, bh: box.l, bw: box.w, tilted: true, rot: 'HxW' },
    );
    return r;
  }

  // Allowed px range for a box of length l at height y (handles LD6/PAJ5
  // lower-deck build-out and keeps >= MIN_PALLET_SUPPORT on the pallet base).
  function xRange(y, h, l) {
    const off = centeredLengthOffset(spec, y, h, useOH, l);
    const effL = usableLengthAtHeight(spec, y, h, useOH, l);
    const minPx = Math.max(-off, -l * (1 - MIN_PALLET_SUPPORT));
    const maxPx = Math.min(effL - l - off, spec.l - l * MIN_PALLET_SUPPORT);
    return [minPx, maxPx];
  }

  const overlap1D = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

  function collides(x, y, z, l, h, w) {
    for (const p of placed) {
      if (overlap1D(x, x + l, p.px, p.px + p.bl) > EPS &&
          overlap1D(y, y + h, p.py, p.py + p.bh) > EPS &&
          overlap1D(z, z + w, p.pz, p.pz + p.bw) > EPS) return true;
    }
    return false;
  }

  // Returns supported fraction, or -1 if the box would rest on a no-stack
  // piece or crush a much lighter piece.
  function support(box, x, y, z, l, w) {
    if (y <= EPS) {
      // floor: part of the box may hang over the pallet edge on build-out ULDs
      const onBase = overlap1D(x, x + l, 0, spec.l) * w;
      return onBase / (l * w);
    }
    let area = 0;
    for (const p of placed) {
      if (Math.abs(p.py + p.bh - y) > EPS) continue;
      const a = overlap1D(x, x + l, p.px, p.px + p.bl) * overlap1D(z, z + w, p.pz, p.pz + p.bw);
      if (a <= 0) continue;
      if (p.noStack) return -1;
      if (box.wt > p.wt * PACK_RULES.heavyOnLightRatio) return -1;
      area += a;
    }
    return area / (l * w);
  }

  // Oversize piece: on the pallet floor, inside the overhang limits, and
  // with at least MIN_PALLET_SUPPORT of its base on the pallet.
  function fitsOversize(box, r, x, y, z) {
    if (y > EPS) return false;
    if (r.bh > effH + EPS) return false;
    if (x < -ovl.length - EPS || x + r.bl > spec.l + ovl.length + EPS) return false;
    if (z < -ovl.width - EPS || z + r.bw > baseW + ovl.width + EPS) return false;
    if (collides(x, y, z, r.bl, r.bh, r.bw)) return false;
    const onBase = overlap1D(x, x + r.bl, 0, spec.l) * overlap1D(z, z + r.bw, 0, baseW);
    return onBase / (r.bl * r.bw) >= MIN_PALLET_SUPPORT - 1e-6;
  }

  function fits(box, r, x, y, z) {
    if (isOversize(box)) return fitsOversize(box, r, x, y, z);
    const [minPx, maxPx] = xRange(y, r.bh, r.bl);
    if (x < minPx - EPS || x > maxPx + EPS) return false;
    if (y < 0 || y + r.bh > effH + EPS) return false;
    if (z < -EPS) return false;
    // width must fit at the bottom, middle and top of the box (LD3 slope)
    for (const yy of [y, y + r.bh * 0.5, y + r.bh]) {
      if (z + r.bw > maxWAt(Math.min(yy, effH)) + EPS) return false;
    }
    if (ld3 && !fitsContour(spec, Math.max(0, x), y, z, r.bl, r.bh, r.bw)) return false;
    if (collides(x, y, z, r.bl, r.bh, r.bw)) return false;
    if (!okUnder(box, x, y + r.bh, z, r.bl, r.bw)) return false;
    return support(box, x, y, z, r.bl, r.bw) >= PACK_RULES.minSupport - 1e-6;
  }

  // A box slipped into a gap may end up UNDER pieces already placed:
  // it must then be stackable and strong enough for them.
  function okUnder(box, x, top, z, l, w) {
    for (const p of placed) {
      if (Math.abs(p.py - top) > EPS) continue;
      if (overlap1D(x, x + l, p.px, p.px + p.bl) <= EPS || overlap1D(z, z + w, p.pz, p.pz + p.bw) <= EPS) continue;
      if (box.noStack) return false;
      if (p.wt > box.wt * PACK_RULES.heavyOnLightRatio) return false;
    }
    return true;
  }

  // ---- extreme points ----------------------------------------------------
  let eps = [{ x: -1e6, y: 0, z: 0 }];  // x is clamped to the allowed minimum
  const epKey = p => `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}`;

  function addEPs(p) {
    const add = [
      { x: p.px + p.bl, y: p.py, z: p.pz },
      { x: p.px, y: p.py + p.bh, z: p.pz },
      { x: p.px, y: p.py, z: p.pz + p.bw },
      { x: p.px + p.bl, y: p.py, z: 0 },
      { x: -1e6, y: p.py, z: p.pz + p.bw },
      { x: -1e6, y: p.py + p.bh, z: p.pz },
      { x: p.px, y: p.py + p.bh, z: 0 },
    ];
    const seen = new Set(eps.map(epKey));
    for (const e of add) {
      if (e.y >= effH - EPS) continue;
      const k = epKey(e);
      if (!seen.has(k)) { seen.add(k); eps.push(e); }
    }
  }

  // Lower score is better: lowest, then most back (x), then left (z).
  function scoreOf(r, x, y, z) {
    return y * 1e7 + x * 1e3 + z + (r.tilted ? 5e9 : 0);
  }

  const failed = new Set();   // shape keys that failed for the current state
  const shapeKey = b => `${b.l}|${b.w}|${b.h}|${b.wt}|${!!b.tiltable}|${!!b.noStack}|${b.dg || ''}|${placed.length}`;

  for (const box of order) {
    // weight / volume / DG quick rejections
    if (loadWt + box.wt > payloadLimit + 1e-6) { rem.push(box); continue; }
    if (loadVol + box.l * box.w * box.h > volLimit) { rem.push(box); continue; }
    const dg = dgClassOf(box);
    if (dg && dgInBin.some(c => dgConflict(c, dg))) { rem.push(box); continue; }
    const sk = shapeKey(box);
    if (failed.has(sk)) { rem.push(box); continue; }

    let best = null;
    if (isOversize(box)) {
      // centred on the pallet first, then next to other oversize pieces
      for (const r of rotations(box)) {
        const cands = [{ x: (spec.l - r.bl) / 2, z: (baseW - r.bw) / 2 }];
        for (const ep of eps) if (ep.y <= EPS) {
          cands.push({ x: Math.max(ep.x, -ovl.length), z: ep.z }, { x: Math.max(ep.x, -ovl.length), z: (baseW - r.bw) / 2 });
        }
        for (const c of cands) {
          if (!fitsOversize(box, r, c.x, 0, c.z)) continue;
          const s = Math.abs(c.x + r.bl / 2 - spec.l / 2) + Math.abs(c.z + r.bw / 2 - baseW / 2) + (r.tilted ? 1e6 : 0);
          if (!best || s < best.s) best = { r, x: c.x, y: 0, z: c.z, s };
        }
      }
    } else {
      for (const ep of eps) {
        for (const r of rotations(box)) {
          const [minPx] = xRange(ep.y, r.bh, r.bl);
          const x = Math.max(ep.x, minPx);
          if (!fits(box, r, x, ep.y, ep.z)) continue;
          const s = scoreOf(r, x, ep.y, ep.z);
          if (!best || s < best.s) best = { r, x, y: ep.y, z: ep.z, s };
        }
      }
    }

    if (!best) { failed.add(sk); rem.push(box); continue; }

    const { r, x, y, z } = best;
    const oh = isOversize(box);
    const ovCm = oh ? Math.round(Math.max(0, -x, x + r.bl - spec.l, -z, z + r.bw - baseW)) : 0;
    const p = {
      ...box, px: x, py: y, pz: z, bl: r.bl, bh: r.bh, bw: r.bw,
      rot: r.rot, tilted: r.tilted, overhang: ovCm > 0, ovCm,
      ovDetail: oh ? {
        front: Math.max(0, Math.round(-x)), back: Math.max(0, Math.round(x + r.bl - spec.l)),
        left: Math.max(0, Math.round(-z)), right: Math.max(0, Math.round(z + r.bw - baseW)),
      } : null,
      balancedExt: !oh && (x < -EPS || x + r.bl > spec.l + EPS),
    };
    placed.push(p);
    loadWt += box.wt;
    loadVol += box.l * box.w * box.h;
    if (dg) dgInBin.push(dg);
    eps = eps.filter(e => !(e.x >= x - EPS && e.x < x + r.bl - EPS &&
                            e.y >= y - EPS && e.y < y + r.bh - EPS &&
                            e.z >= z - EPS && e.z < z + r.bw - EPS));
    addEPs(p);
  }

  // Put the remaining pieces back in their original order for the next ULD.
  const idx = new Map(boxes.map((b, i) => [b, i]));
  rem.sort((a, b) => idx.get(a) - idx.get(b));

  return { placed, rem, stats: buildStats(placed, spec) };
}

/* Centre of gravity and checks for one built ULD (also used by the test page). */
function buildStats(placed, spec) {
  let wt = 0, mx = 0, my = 0, mz = 0;
  for (const p of placed) {
    wt += p.wt;
    mx += p.wt * (p.px + p.bl / 2);
    my += p.wt * (p.py + p.bh / 2);
    mz += p.wt * (p.pz + p.bw / 2);
  }
  const cg = wt ? { x: mx / wt, y: my / wt, z: mz / wt } : null;
  const widthRef = spec.profile ? spec.profile.baseW : spec.w;
  return {
    weight: wt,
    cg,
    cgOffsetL: cg ? +(cg.x - spec.l / 2).toFixed(1) : 0,   // + = toward far end
    cgOffsetW: cg ? +(cg.z - widthRef / 2).toFixed(1) : 0,
    cgHeight: cg ? +cg.y.toFixed(1) : 0,
  };
}

/* Independent checker: same rules, used to compare v3 and v2 results. */
function checkBuild(placed, spec) {
  const EPS = 0.5, issues = [];
  const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const name = p => `${p.desc || 'piece'} #${p.piece || ''}`.trim();
  let wt = 0;
  const lim = overhangLimits(spec);
  const bw0 = spec.profile ? spec.profile.baseW : spec.w;
  placed.forEach((p, i) => {
    wt += p.wt;
    const outL = Math.max(-p.px, p.px + p.bl - spec.l), outW = Math.max(-p.pz, p.pz + p.bw - (p.py < 1 ? bw0 : spec.w));
    if (p.ovDetail) {
      if (outL > lim.length + EPS || outW > lim.width + EPS)
        issues.push({ type: 'overhang', msg: `${name(p)} overhangs ${Math.round(Math.max(outL, outW))} cm, limit ${lim.length} cm length / ${lim.width} cm width` });
    } else if (!spec.lowerDeckExtension && (outL > EPS || outW > EPS)) {
      issues.push({ type: 'outside', msg: `${name(p)} sticks out of the ULD by ${Math.round(Math.max(outL, outW))} cm` });
    }
    for (let j = i + 1; j < placed.length; j++) {
      const q = placed[j];
      if (ov(p.px, p.px + p.bl, q.px, q.px + q.bl) > EPS && ov(p.py, p.py + p.bh, q.py, q.py + q.bh) > EPS &&
          ov(p.pz, p.pz + p.bw, q.pz, q.pz + q.bw) > EPS) issues.push({ type: 'overlap', msg: `${name(p)} overlaps ${name(q)}` });
    }
    if (p.py > EPS) {
      let area = 0;
      for (const q of placed) {
        if (q === p || Math.abs(q.py + q.bh - p.py) > EPS) continue;
        const a = ov(p.px, p.px + p.bl, q.px, q.px + q.bl) * ov(p.pz, p.pz + p.bw, q.pz, q.pz + q.bw);
        if (a <= 0) continue;
        area += a;
        if (q.noStack) issues.push({ type: 'noStack', msg: `${name(p)} is loaded on no-stack ${name(q)}` });
        if (p.wt > q.wt * PACK_RULES.heavyOnLightRatio) issues.push({ type: 'heavyOnLight', msg: `${name(p)} (${p.wt} kg) sits on ${name(q)} (${q.wt} kg)` });
      }
      const s = area / (p.bl * p.bw);
      if (s < PACK_RULES.minSupport - 1e-6) issues.push({ type: 'floating', msg: `${name(p)} only ${Math.round(s * 100)}% supported` });
    }
  });
  const limit = spec.maxWt ? spec.maxWt - (spec.tare || 0) : Infinity;
  if (wt > limit + 1e-6) issues.push({ type: 'overweight', msg: `${Math.round(wt)} kg loaded, limit ${limit} kg` });
  const dgs = placed.map(dgClassOf).filter(Boolean);
  for (let i = 0; i < dgs.length; i++) for (let j = i + 1; j < dgs.length; j++)
    if (dgConflict(dgs[i], dgs[j])) { issues.push({ type: 'dg', msg: `DG class ${dgs[i]} with class ${dgs[j]} in same ULD` }); i = dgs.length; break; }
  return issues;
}

if (typeof module !== 'undefined') module.exports = { packBin, buildStats, checkBuild, dgConflict, doorFitReason, centerLoadFit, centerLoadEnvelope, pickCenterLoadPositions, PACK_RULES };
