"use client"
import { useState } from "react"

const aircraft = [
  { id: "ET608", type: "B777F", reg: "ET-AXF", route: "ADD→DXB", maxPayload: 102000 },
  { id: "ET512", type: "B787-9", reg: "ET-AXM", route: "ADD→LHR", maxPayload: 43000 },
  { id: "ET302", type: "B777F", reg: "ET-AXG", route: "ADD→HKG", maxPayload: 102000 },
]

const positions: Record<string, any[]> = {
  "ET608": [
    { id: "P1", x: 10, y: 20, w: 12, h: 18, deck: "main", uld: "PMC-1234", weight: 3230, commodity: "Pharma", status: "loaded" },
    { id: "P2", x: 24, y: 20, w: 12, h: 18, deck: "main", uld: "PMC-5678", weight: 4100, commodity: "Courier", status: "loaded" },
    { id: "P3", x: 38, y: 20, w: 12, h: 18, deck: "main", uld: "PMC-9012", weight: 2800, commodity: "General", status: "loading" },
    { id: "P4", x: 52, y: 20, w: 12, h: 18, deck: "main", uld: "PAG-3456", weight: 3600, commodity: "Perishable", status: "planned" },
    { id: "P5", x: 66, y: 20, w: 12, h: 18, deck: "main", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "P6", x: 80, y: 20, w: 12, h: 18, deck: "main", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L1", x: 10, y: 50, w: 8, h: 12, deck: "lower", uld: "AKE-1111", weight: 890, commodity: "Electronics", status: "loaded" },
    { id: "L2", x: 20, y: 50, w: 8, h: 12, deck: "lower", uld: "AKE-2222", weight: 1200, commodity: "General", status: "loaded" },
    { id: "L3", x: 30, y: 50, w: 8, h: 12, deck: "lower", uld: "AKE-3333", weight: 560, commodity: "Pharma", status: "loaded" },
    { id: "L4", x: 40, y: 50, w: 8, h: 12, deck: "lower", uld: "AKE-4444", weight: 780, commodity: "Courier", status: "loading" },
    { id: "L5", x: 50, y: 50, w: 8, h: 12, deck: "lower", uld: "RKN-5555", weight: 450, commodity: "Cool Chain", status: "planned" },
    { id: "L6", x: 60, y: 50, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L7", x: 70, y: 50, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L8", x: 80, y: 50, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
  ],
  "ET512": [
    { id: "L1", x: 10, y: 35, w: 8, h: 12, deck: "lower", uld: "AKE-6666", weight: 1100, commodity: "General", status: "loaded" },
    { id: "L2", x: 20, y: 35, w: 8, h: 12, deck: "lower", uld: "AKE-7777", weight: 890, commodity: "Electronics", status: "loaded" },
    { id: "L3", x: 30, y: 35, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L4", x: 40, y: 35, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L5", x: 50, y: 35, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L6", x: 60, y: 35, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
  ],
  "ET302": [
    { id: "P1", x: 10, y: 20, w: 12, h: 18, deck: "main", uld: "PMC-2233", weight: 5100, commodity: "General", status: "loaded" },
    { id: "P2", x: 24, y: 20, w: 12, h: 18, deck: "main", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "P3", x: 38, y: 20, w: 12, h: 18, deck: "main", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "P4", x: 52, y: 20, w: 12, h: 18, deck: "main", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L1", x: 10, y: 50, w: 8, h: 12, deck: "lower", uld: "AKE-8888", weight: 670, commodity: "Courier", status: "loaded" },
    { id: "L2", x: 20, y: 50, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L3", x: 30, y: 50, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
    { id: "L4", x: 40, y: 50, w: 8, h: 12, deck: "lower", uld: "", weight: 0, commodity: "", status: "empty" },
  ],
}

const statusColor: Record<string, string> = {
  loaded: "#22C55E",
  loading: "#EAB308",
  planned: "#3B82F6",
  empty: "#1f1f1f",
}

const statusBorder: Record<string, string> = {
  loaded: "#16A34A",
  loading: "#CA8A04",
  planned: "#2563EB",
  empty: "#333",
}

export default function ThreeDViewPage() {
  const [selectedAC, setSelectedAC] = useState("ET608")
  const [selectedPos, setSelectedPos] = useState<any>(null)
  const [view, setView] = useState<"top"|"side">("top")

  const ac = aircraft.find(a => a.id === selectedAC)!
  const pos = positions[selectedAC]
  const loaded = pos.filter(p => p.status !== "empty")
  const totalWeight = loaded.reduce((s, p) => s + p.weight, 0)
  const utilization = Math.round((totalWeight / ac.maxPayload) * 100)
  const fwdWeight = loaded.filter(p => p.x < 45).reduce((s, p) => s + p.weight, 0)
  const aftWeight = loaded.filter(p => p.x >= 45).reduce((s, p) => s + p.weight, 0)
  const cgPosition = fwdWeight + aftWeight > 0 ? Math.round((aftWeight / (fwdWeight + aftWeight)) * 100) : 50

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">3D View</h1>
          <p className="text-gray-400 text-sm mt-1">Interactive aircraft load visualization</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("top")}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (view === "top" ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}>
            Top View
          </button>
          <button onClick={() => setView("side")}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (view === "side" ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}>
            Side View
          </button>
        </div>
      </div>

      {/* Aircraft Selector */}
      <div className="flex gap-3 mb-4">
        {aircraft.map(a => (
          <button key={a.id} onClick={() => { setSelectedAC(a.id); setSelectedPos(null) }}
            className={"px-4 py-3 rounded-xl border text-left transition-all " +
              (selectedAC === a.id ? "border-yellow-500 bg-yellow-500/10" : "border-white/10 bg-[#141414]")}>
            <p className={"font-bold text-sm " + (selectedAC === a.id ? "text-yellow-400" : "text-white")}>{a.id}</p>
            <p className="text-xs text-gray-400">{a.route} · {a.type}</p>
          </button>
        ))}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          { label: "Total Weight", value: `${(totalWeight/1000).toFixed(1)}T`, color: "text-white" },
          { label: "Utilization", value: `${utilization}%`, color: utilization > 80 ? "text-green-400" : "text-yellow-400" },
          { label: "Loaded Positions", value: `${loaded.length}/${pos.length}`, color: "text-blue-400" },
          { label: "FWD Weight", value: `${(fwdWeight/1000).toFixed(1)}T`, color: "text-purple-400" },
          { label: "AFT Weight", value: `${(aftWeight/1000).toFixed(1)}T`, color: "text-orange-400" },
        ].map((k, i) => (
          <div key={i} className="bg-[#141414] rounded-xl border border-white/5 p-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{k.label}</p>
            <p className={"text-lg font-bold " + k.color}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* LEFT — ULD List */}
        <div className="col-span-3">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-3">Loaded ULDs</p>
            <div className="space-y-2">
              {loaded.map((p, i) => (
                <div key={i} onClick={() => setSelectedPos(p)}
                  className={"p-3 rounded-lg cursor-pointer border transition-all " +
                    (selectedPos?.id === p.id ? "border-yellow-500 bg-yellow-500/10" : "border-white/5 hover:bg-white/5")}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-yellow-400 text-xs font-bold">{p.id}</span>
                    <div className="w-2 h-2 rounded-full" style={{ background: statusColor[p.status] }}></div>
                  </div>
                  <p className="text-white text-xs">{p.uld}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-400 text-xs">{p.commodity}</span>
                    <span className="text-gray-300 text-xs">{p.weight}kg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — Aircraft Visual */}
        <div className="col-span-6">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-3">
              {ac.id} — {ac.type} ({ac.reg}) — {view === "top" ? "Top View" : "Side View"}
            </p>

            {/* Legend */}
            <div className="flex gap-3 mb-4 flex-wrap">
              {[["loaded","#22C55E","Loaded"],["loading","#EAB308","Loading"],["planned","#3B82F6","Planned"],["empty","#333","Empty"]].map(([k,c,l]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm border" style={{ background: c, borderColor: c }}></div>
                  <span className="text-gray-400 text-xs">{l}</span>
                </div>
              ))}
            </div>

            {/* SVG Aircraft View */}
            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
              {view === "top" ? (
                <svg viewBox="0 0 100 80" className="w-full" style={{ height: 320 }}>
                  {/* Aircraft body outline */}
                  <ellipse cx="50" cy="40" rx="42" ry="22" fill="none" stroke="#333" strokeWidth="0.5" />
                  {/* Nose */}
                  <ellipse cx="8" cy="40" rx="5" ry="12" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
                  {/* Tail */}
                  <ellipse cx="92" cy="40" rx="5" ry="8" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
                  {/* Wings */}
                  <ellipse cx="50" cy="40" rx="8" ry="38" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />

                  {/* Main deck label */}
                  <text x="5" y="18" fill="#666" fontSize="3" fontFamily="monospace">MAIN DECK</text>
                  {/* Lower deck label */}
                  <text x="5" y="48" fill="#666" fontSize="3" fontFamily="monospace">LOWER DECK</text>

                  {/* ULD Positions */}
                  {pos.map((p) => (
                    <g key={p.id} onClick={() => setSelectedPos(p)} style={{ cursor: "pointer" }}>
                      <rect
                        x={p.x} y={p.y} width={p.w} height={p.h}
                        rx="1"
                        fill={statusColor[p.status]}
                        stroke={selectedPos?.id === p.id ? "#EAB308" : statusBorder[p.status]}
                        strokeWidth={selectedPos?.id === p.id ? "1" : "0.5"}
                        opacity={p.status === "empty" ? 0.4 : 0.85}
                      />
                      <text x={p.x + p.w/2} y={p.y + p.h/2 - 1} textAnchor="middle" fill="#fff" fontSize="2.5" fontWeight="bold" fontFamily="monospace">
                        {p.id}
                      </text>
                      {p.uld && (
                        <text x={p.x + p.w/2} y={p.y + p.h/2 + 3} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="2" fontFamily="monospace">
                          {p.weight}kg
                        </text>
                      )}
                    </g>
                  ))}

                  {/* CG Indicator */}
                  <line x1={cgPosition * 0.8 + 5} y1="5" x2={cgPosition * 0.8 + 5} y2="75" stroke="#EAB308" strokeWidth="0.5" strokeDasharray="2,2" />
                  <text x={cgPosition * 0.8 + 6} y="10" fill="#EAB308" fontSize="2.5" fontFamily="monospace">CG</text>
                </svg>
              ) : (
                <svg viewBox="0 0 100 60" className="w-full" style={{ height: 320 }}>
                  {/* Side profile */}
                  {/* Fuselage */}
                  <rect x="8" y="20" width="84" height="20" rx="10" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
                  {/* Nose cone */}
                  <ellipse cx="8" cy="30" rx="6" ry="10" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
                  {/* Tail fin */}
                  <polygon points="88,20 92,10 96,20" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
                  {/* Wing */}
                  <polygon points="35,30 65,30 70,40 30,40" fill="#222" stroke="#444" strokeWidth="0.5" />
                  {/* Main deck floor */}
                  <line x1="10" y1="27" x2="90" y2="27" stroke="#333" strokeWidth="0.3" />
                  {/* Lower deck floor */}
                  <line x1="10" y1="33" x2="90" y2="33" stroke="#333" strokeWidth="0.3" />

                  {/* Main deck ULDs */}
                  {pos.filter(p => p.deck === "main").map((p, i) => (
                    <g key={p.id} onClick={() => setSelectedPos(p)} style={{ cursor: "pointer" }}>
                      <rect x={12 + i * 13} y="21" width="11" height="6"
                        fill={statusColor[p.status]}
                        stroke={selectedPos?.id === p.id ? "#EAB308" : statusBorder[p.status]}
                        strokeWidth={selectedPos?.id === p.id ? "0.8" : "0.3"}
                        opacity={p.status === "empty" ? 0.3 : 0.85} rx="0.5" />
                      <text x={12 + i * 13 + 5.5} y="25.5" textAnchor="middle" fill="#fff" fontSize="2" fontFamily="monospace">{p.id}</text>
                    </g>
                  ))}

                  {/* Lower deck ULDs */}
                  {pos.filter(p => p.deck === "lower").map((p, i) => (
                    <g key={p.id} onClick={() => setSelectedPos(p)} style={{ cursor: "pointer" }}>
                      <rect x={12 + i * 9} y="28" width="8" height="4"
                        fill={statusColor[p.status]}
                        stroke={selectedPos?.id === p.id ? "#EAB308" : statusBorder[p.status]}
                        strokeWidth={selectedPos?.id === p.id ? "0.8" : "0.3"}
                        opacity={p.status === "empty" ? 0.3 : 0.85} rx="0.5" />
                      <text x={12 + i * 9 + 4} y="31.2" textAnchor="middle" fill="#fff" fontSize="1.8" fontFamily="monospace">{p.id}</text>
                    </g>
                  ))}

                  {/* Labels */}
                  <text x="3" y="25" fill="#666" fontSize="2.5" fontFamily="monospace">MD</text>
                  <text x="3" y="31.5" fill="#666" fontSize="2.5" fontFamily="monospace">LD</text>

                  {/* CG line */}
                  <line x1={cgPosition * 0.8 + 5} y1="15" x2={cgPosition * 0.8 + 5} y2="45" stroke="#EAB308" strokeWidth="0.5" strokeDasharray="2,2" />
                  <text x={cgPosition * 0.8 + 6} y="18" fill="#EAB308" fontSize="2.5" fontFamily="monospace">CG {cgPosition}%</text>
                </svg>
              )}
            </div>

            {/* Weight Distribution Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>FWD — {(fwdWeight/1000).toFixed(1)}T</span>
                <span>Weight Distribution</span>
                <span>AFT — {(aftWeight/1000).toFixed(1)}T</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden">
                <div className="bg-purple-500 transition-all" style={{ width: fwdWeight/(fwdWeight+aftWeight||1)*100+"%" }}></div>
                <div className="bg-orange-500 transition-all" style={{ width: aftWeight/(fwdWeight+aftWeight||1)*100+"%" }}></div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-purple-400">Forward</span>
                <span className="text-orange-400">Aft</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Position Detail */}
        <div className="col-span-3">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4 h-full">
            {selectedPos ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-semibold">Position {selectedPos.id}</p>
                  <div className="w-3 h-3 rounded-full" style={{ background: statusColor[selectedPos.status] }}></div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "ULD Number", value: selectedPos.uld || "Empty" },
                    { label: "Deck", value: selectedPos.deck === "main" ? "Main Deck" : "Lower Deck" },
                    { label: "Status", value: selectedPos.status.charAt(0).toUpperCase() + selectedPos.status.slice(1) },
                    { label: "Commodity", value: selectedPos.commodity || "—" },
                    { label: "Weight", value: selectedPos.weight ? selectedPos.weight + " kg" : "—" },
                  ].map((item, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">{item.label}</p>
                      <p className="text-white text-sm font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>
                {selectedPos.weight > 0 && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-yellow-400 text-xs font-medium">Weight Share</p>
                    <p className="text-white text-lg font-bold mt-1">
                      {Math.round((selectedPos.weight / totalWeight) * 100)}%
                    </p>
                    <p className="text-gray-400 text-xs">of total aircraft load</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <p className="text-4xl mb-3">✈️</p>
                <p className="text-white font-semibold text-sm">Click any position</p>
                <p className="text-gray-400 text-xs mt-1">Select a ULD position on the aircraft to see details</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}