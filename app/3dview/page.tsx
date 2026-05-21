"use client"
import { useState } from "react"

const uldLibrary: Record<string, any> = {
  PMC: { maxWeight: 6804, maxVolume: 13.5, length: 317, width: 244, height: 244, color: "#EAB308" },
  PAG: { maxWeight: 6804, maxVolume: 11.0, length: 317, width: 244, height: 203, color: "#3B82F6" },
  AKE: { maxWeight: 1588, maxVolume: 4.3, length: 156, width: 153, height: 163, color: "#22C55E" },
  RKN: { maxWeight: 1588, maxVolume: 4.5, length: 156, width: 153, height: 163, color: "#8B5CF6" },
}

const ulds = [
  {
    id: "PMC-1234-ET", type: "PMC", flight: "ET608",
    shipments: [
      { awb: "057-11111", commodity: "Pharma", pieces: 6, weight: 720, l: 80, w: 60, h: 70, color: "#3B82F6", stackable: false, priority: "Critical" },
      { awb: "057-22222", commodity: "Electronics", pieces: 4, weight: 480, l: 70, w: 50, h: 60, color: "#22C55E", stackable: true, priority: "High" },
      { awb: "057-33333", commodity: "General", pieces: 8, weight: 960, l: 100, w: 80, h: 50, color: "#F59E0B", stackable: true, priority: "Normal" },
      { awb: "057-44444", commodity: "Courier", pieces: 12, weight: 340, l: 50, w: 40, h: 40, color: "#EC4899", stackable: true, priority: "High" },
    ]
  },
  {
    id: "AKE-5678-ET", type: "AKE", flight: "ET608",
    shipments: [
      { awb: "057-55555", commodity: "Pharmaceuticals", pieces: 3, weight: 360, l: 60, w: 50, h: 55, color: "#8B5CF6", stackable: false, priority: "Critical" },
      { awb: "057-66666", commodity: "Documents", pieces: 20, weight: 180, l: 40, w: 30, h: 20, color: "#06B6D4", stackable: true, priority: "Normal" },
    ]
  },
  {
    id: "RKN-9012-ET", type: "RKN", flight: "ET608",
    shipments: [
      { awb: "057-77777", commodity: "Cool Chain", pieces: 4, weight: 480, l: 70, w: 60, h: 65, color: "#0EA5E9", stackable: false, priority: "High" },
    ]
  },
]

const priorityBadge: Record<string, string> = {
  "Critical": "bg-red-500/20 text-red-400",
  "High": "bg-orange-500/20 text-orange-400",
  "Normal": "bg-gray-500/20 text-gray-400",
}

export default function ThreeDViewPage() {
  const [selectedULD, setSelectedULD] = useState(ulds[0])
  const [selectedShipment, setSelectedShipment] = useState<any>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)

  const uld = uldLibrary[selectedULD.type]
  const totalWeight = selectedULD.shipments.reduce((s, x) => s + x.weight, 0)
  const weightUtil = Math.round((totalWeight / uld.maxWeight) * 100)
  const volUsed = selectedULD.shipments.reduce((s, x) => s + (x.l * x.w * x.h) / 1000000, 0)
  const volUtil = Math.round((volUsed / uld.maxVolume) * 100)

  // Simple 2D packing layout for front view (scaled to SVG)
  const scaleX = 220 / uld.length
  const scaleY = 160 / uld.height

  // Auto-place boxes in rows
  const placements: any[] = []
  let curX = 0, curY = 0, rowH = 0
  selectedULD.shipments.forEach((s) => {
    if (curX + s.l > uld.length) { curX = 0; curY += rowH; rowH = 0 }
    placements.push({ ...s, px: curX, py: uld.height - curY - s.h })
    curX += s.l
    rowH = Math.max(rowH, s.h)
  })

  // Top view placements
  const scaleTopX = 220 / uld.length
  const scaleTopY = 120 / uld.width
  let curTX = 0, curTY = 0, rowTW = 0
  const topPlacements: any[] = []
  selectedULD.shipments.forEach((s) => {
    if (curTX + s.l > uld.length) { curTX = 0; curTY += rowTW; rowTW = 0 }
    topPlacements.push({ ...s, px: curTX, py: curTY })
    curTX += s.l
    rowTW = Math.max(rowTW, s.w)
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">ULD Internal View</h1>
          <p className="text-gray-400 text-sm mt-1">Visual cargo build-up inside ULD containers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHeatmap(!showHeatmap)}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (showHeatmap ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}>
            {showHeatmap ? "● Heatmap ON" : "Heatmap"}
          </button>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            🤖 AI Optimize Build
          </button>
        </div>
      </div>

      {/* ULD Selector */}
      <div className="flex gap-3 mb-4">
        {ulds.map(u => {
          const ul = uldLibrary[u.type]
          const tw = u.shipments.reduce((s, x) => s + x.weight, 0)
          const pct = Math.round((tw / ul.maxWeight) * 100)
          return (
            <button key={u.id} onClick={() => { setSelectedULD(u); setSelectedShipment(null) }}
              className={"px-4 py-3 rounded-xl border text-left transition-all " +
                (selectedULD.id === u.id ? "border-yellow-500 bg-yellow-500/10" : "border-white/10 bg-[#141414]")}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-sm" style={{ background: ul.color }}></div>
                <p className={"font-bold text-sm " + (selectedULD.id === u.id ? "text-yellow-400" : "text-white")}>{u.id}</p>
              </div>
              <p className="text-xs text-gray-400">{u.type} · {u.flight}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-16 h-1 bg-white/10 rounded-full">
                  <div className="h-full rounded-full" style={{ width: pct+"%", background: ul.color }}></div>
                </div>
                <span className="text-xs text-gray-400">{pct}%</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {[
          { label: "ULD Type", value: selectedULD.type, color: "text-yellow-400" },
          { label: "Max Weight", value: `${uld.maxWeight}kg`, color: "text-gray-300" },
          { label: "Loaded Weight", value: `${totalWeight}kg`, color: "text-white" },
          { label: "Weight Util", value: `${weightUtil}%`, color: weightUtil > 90 ? "text-red-400" : weightUtil > 70 ? "text-yellow-400" : "text-green-400" },
          { label: "Volume Util", value: `${volUtil}%`, color: volUtil > 90 ? "text-red-400" : "text-blue-400" },
          { label: "Shipments", value: `${selectedULD.shipments.length}`, color: "text-purple-400" },
        ].map((k, i) => (
          <div key={i} className="bg-[#141414] rounded-xl border border-white/5 p-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{k.label}</p>
            <p className={"text-lg font-bold " + k.color}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* LEFT — Shipment List */}
        <div className="col-span-3">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-3">Cargo Items in {selectedULD.id}</p>
            <div className="space-y-2">
              {selectedULD.shipments.map((s, i) => (
                <div key={i} onClick={() => setSelectedShipment(selectedShipment?.awb === s.awb ? null : s)}
                  className={"p-3 rounded-lg cursor-pointer border transition-all " +
                    (selectedShipment?.awb === s.awb ? "border-yellow-500 bg-yellow-500/10" : "border-white/5 hover:bg-white/5")}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }}></div>
                    <span className="text-yellow-400 text-xs font-bold">{s.awb}</span>
                  </div>
                  <p className="text-white text-xs font-medium">{s.commodity}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-400 text-xs">{s.pieces} pcs · {s.weight}kg</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500 text-xs">{s.l}×{s.w}×{s.h}cm</span>
                    <span className={"text-xs px-1.5 rounded " + priorityBadge[s.priority]}>{s.priority}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className={"text-xs " + (s.stackable ? "text-green-400" : "text-red-400")}>
                      {s.stackable ? "✓ Stackable" : "✗ No Stack"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Weight bar */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Weight</span>
                <span>{totalWeight}/{uld.maxWeight}kg</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full">
                <div className={"h-full rounded-full " + (weightUtil > 90 ? "bg-red-500" : weightUtil > 70 ? "bg-yellow-500" : "bg-green-500")}
                  style={{ width: weightUtil+"%" }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2 mb-1">
                <span>Volume</span>
                <span>{volUtil}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: volUtil+"%" }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER — ULD Visual */}
        <div className="col-span-6 space-y-4">

          {/* Front View */}
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">Front View — {selectedULD.type} ({uld.length}×{uld.width}×{uld.height}cm)</p>
              <div className="flex gap-3 text-xs text-gray-400">
                <span>W: {weightUtil}% loaded</span>
                <span>V: {volUtil}% used</span>
              </div>
            </div>
            <div className="bg-black/50 rounded-xl p-3 border border-white/10">
              <svg viewBox={`0 0 240 180`} className="w-full" style={{ height: 240 }}>
                {/* ULD Container outline */}
                <rect x="10" y="10" width="220" height="160" rx="4"
                  fill="rgba(255,255,255,0.02)" stroke={uld.color} strokeWidth="1.5" strokeDasharray="4,2" />

                {/* Floor line */}
                <line x1="10" y1="168" x2="230" y2="168" stroke="#444" strokeWidth="1" />

                {/* Grid lines */}
                {[1,2,3,4].map(i => (
                  <line key={i} x1="10" y1={10 + i*32} x2="230" y2={10 + i*32}
                    stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                ))}

                {/* Shipment boxes */}
                {placements.map((s, i) => {
                  const bx = 10 + s.px * scaleX
                  const by = 10 + (uld.height - s.py - s.h) * scaleY
                  const bw = Math.max(s.l * scaleX - 1, 8)
                  const bh = Math.max(s.h * scaleY - 1, 8)
                  const isSelected = selectedShipment?.awb === s.awb
                  const fillColor = showHeatmap
                    ? `hsl(${120 - (s.weight / totalWeight * 180)}, 80%, 40%)`
                    : s.color

                  return (
                    <g key={i} onClick={() => setSelectedShipment(isSelected ? null : s)} style={{ cursor: "pointer" }}>
                      <rect x={bx} y={by} width={bw} height={bh} rx="2"
                        fill={fillColor}
                        stroke={isSelected ? "#EAB308" : "rgba(0,0,0,0.4)"}
                        strokeWidth={isSelected ? "2" : "0.5"}
                        opacity="0.85" />
                      {bw > 20 && bh > 12 && (
                        <text x={bx + bw/2} y={by + bh/2 + 1} textAnchor="middle"
                          fill="white" fontSize="7" fontWeight="bold" fontFamily="monospace">
                          {s.commodity.slice(0,4)}
                        </text>
                      )}
                      {bw > 20 && bh > 22 && (
                        <text x={bx + bw/2} y={by + bh/2 + 9} textAnchor="middle"
                          fill="rgba(255,255,255,0.7)" fontSize="5.5" fontFamily="monospace">
                          {s.weight}kg
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Empty space indicator */}
                {volUtil < 100 && (
                  <text x="120" y="175" textAnchor="middle" fill="#666" fontSize="7" fontFamily="monospace">
                    {100 - volUtil}% unused space
                  </text>
                )}

                {/* Contour height line */}
                <line x1="10" y1="10" x2="230" y2="10" stroke={uld.color} strokeWidth="1" opacity="0.5" />
                <text x="12" y="8" fill={uld.color} fontSize="6" fontFamily="monospace">MAX HEIGHT {uld.height}cm</text>

                {/* Weight distribution indicator */}
                <rect x="10" y="170" width="220" height="6" rx="2" fill="rgba(255,255,255,0.05)" />
                <rect x="10" y="170" width={220 * weightUtil / 100} height="6" rx="2"
                  fill={weightUtil > 90 ? "#EF4444" : weightUtil > 70 ? "#EAB308" : "#22C55E"} />
              </svg>
            </div>
          </div>

          {/* Top View */}
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-3">Top View — Floor Plan ({uld.length}×{uld.width}cm)</p>
            <div className="bg-black/50 rounded-xl p-3 border border-white/10">
              <svg viewBox="0 0 240 140" className="w-full" style={{ height: 160 }}>
                {/* Container outline */}
                <rect x="10" y="10" width="220" height="120" rx="4"
                  fill="rgba(255,255,255,0.02)" stroke={uld.color} strokeWidth="1.5" strokeDasharray="4,2" />

                {/* Grid */}
                {[1,2,3].map(i => (
                  <line key={i} x1="10" y1={10 + i*30} x2="230" y2={10 + i*30}
                    stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                ))}

                {/* Boxes top view */}
                {topPlacements.map((s, i) => {
                  const bx = 10 + s.px * scaleTopX
                  const by = 10 + s.py * scaleTopY
                  const bw = Math.max(s.l * scaleTopX - 1, 6)
                  const bh = Math.max(s.w * scaleTopY - 1, 6)
                  const isSelected = selectedShipment?.awb === s.awb
                  return (
                    <g key={i} onClick={() => setSelectedShipment(isSelected ? null : s)} style={{ cursor: "pointer" }}>
                      <rect x={bx} y={by} width={bw} height={bh} rx="2"
                        fill={s.color}
                        stroke={isSelected ? "#EAB308" : "rgba(0,0,0,0.4)"}
                        strokeWidth={isSelected ? "2" : "0.5"}
                        opacity="0.8" />
                      {bw > 18 && bh > 10 && (
                        <text x={bx + bw/2} y={by + bh/2 + 2} textAnchor="middle"
                          fill="white" fontSize="6" fontFamily="monospace">
                          {s.awb.slice(-5)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* RIGHT — Detail Panel */}
        <div className="col-span-3">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4 mb-4">
            <p className="text-white font-semibold text-sm mb-3">ULD Specifications</p>
            <div className="space-y-2">
              {[
                { label: "Type", value: selectedULD.type },
                { label: "Dimensions", value: `${uld.length}×${uld.width}×${uld.height}cm` },
                { label: "Max Weight", value: `${uld.maxWeight}kg` },
                { label: "Max Volume", value: `${uld.maxVolume}m³` },
                { label: "Items", value: `${selectedULD.shipments.length} shipments` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-400 text-xs">{item.label}</span>
                  <span className="text-white text-xs font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedShipment ? (
            <div className="bg-[#141414] rounded-xl border border-yellow-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-sm" style={{ background: selectedShipment.color }}></div>
                <p className="text-white font-semibold text-sm">{selectedShipment.awb}</p>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Commodity", value: selectedShipment.commodity },
                  { label: "Pieces", value: selectedShipment.pieces },
                  { label: "Weight", value: `${selectedShipment.weight}kg` },
                  { label: "Dimensions", value: `${selectedShipment.l}×${selectedShipment.w}×${selectedShipment.h}cm` },
                  { label: "Priority", value: selectedShipment.priority },
                  { label: "Stackable", value: selectedShipment.stackable ? "Yes" : "No" },
                  { label: "Weight Share", value: Math.round(selectedShipment.weight/totalWeight*100)+"%" },
                  { label: "Volume", value: `${((selectedShipment.l*selectedShipment.w*selectedShipment.h)/1000000).toFixed(3)}m³` },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-gray-400 text-xs">{item.label}</span>
                    <span className="text-white text-xs font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
              <p className="text-white font-semibold text-sm mb-3">AI Build Analysis</p>
              <div className="space-y-2">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-green-400 text-xs font-medium">✓ Weight OK</p>
                  <p className="text-gray-400 text-xs">{uld.maxWeight - totalWeight}kg remaining</p>
                </div>
                <div className={"border rounded-lg p-3 " + (volUtil > 85 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-blue-500/10 border-blue-500/20")}>
                  <p className={"text-xs font-medium " + (volUtil > 85 ? "text-yellow-400" : "text-blue-400")}>
                    {volUtil > 85 ? "⚠ High Volume" : "✓ Volume OK"}
                  </p>
                  <p className="text-gray-400 text-xs">{volUtil}% volume used</p>
                </div>
                {selectedULD.shipments.some(s => !s.stackable) && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-red-400 text-xs font-medium">⚠ Non-stackable items</p>
                    <p className="text-gray-400 text-xs">Check placement order</p>
                  </div>
                )}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-purple-400 text-xs font-medium">🤖 AI Suggestion</p>
                  <p className="text-gray-400 text-xs">Place pharma items on top — temperature sensitive</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}