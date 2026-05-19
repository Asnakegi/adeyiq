"use client"
import { useState } from "react"

const flights = [
  { id: "ET608", route: "ADD→DXB", aircraft: "B777F", reg: "ET-AXF", maxPayload: 102000, mainSlots: 6, lowerSlots: 10 },
  { id: "ET512", route: "ADD→LHR", aircraft: "B787-9", reg: "ET-AXM", maxPayload: 43000, mainSlots: 0, lowerSlots: 16 },
  { id: "ET302", route: "ADD→HKG", aircraft: "B777F", reg: "ET-AXG", maxPayload: 102000, mainSlots: 6, lowerSlots: 10 },
]

const shipmentQueue = {
  ready: [
    { awb: "057-12345678", commodity: "Pharma", weight: 1240, pieces: 12, priority: "Critical", yield: 5.8, dg: false },
    { awb: "057-23456789", commodity: "Electronics", weight: 890, pieces: 6, priority: "High", yield: 4.2, dg: false },
    { awb: "057-34567890", commodity: "General", weight: 2100, pieces: 24, priority: "Normal", yield: 2.1, dg: false },
    { awb: "057-45678901", commodity: "Courier", weight: 340, pieces: 80, priority: "High", yield: 6.1, dg: false },
  ],
  priority: [
    { awb: "057-56789012", commodity: "Diplomatic", weight: 45, pieces: 2, priority: "Must Fly", yield: 9.9, dg: false },
    { awb: "057-67890123", commodity: "Humanitarian", weight: 680, pieces: 8, priority: "Must Fly", yield: 0, dg: false },
  ],
  waitlist: [
    { awb: "057-78901234", commodity: "DG Class 3", weight: 120, pieces: 4, priority: "Normal", yield: 3.2, dg: true },
    { awb: "057-89012345", commodity: "Perishable", weight: 1800, pieces: 40, priority: "High", yield: 3.8, dg: false },
  ],
}

const aircraftPositions = {
  "ET608": {
    main: [
      { pos: "P1", uld: "PMC-1234", weight: 3230, commodity: "Pharma", status: "loaded", priority: "Critical" },
      { pos: "P2", uld: "PMC-5678", weight: 4100, commodity: "Courier", status: "loaded", priority: "High" },
      { pos: "P3", uld: "PMC-9012", weight: 2800, commodity: "General", status: "loading", priority: "Normal" },
      { pos: "P4", uld: "PAG-3456", weight: 3600, commodity: "Perishable", status: "planned", priority: "High" },
      { pos: "P5", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "P6", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
    ],
    lower: [
      { pos: "L1", uld: "AKE-1111", weight: 890, commodity: "Electronics", status: "loaded", priority: "High" },
      { pos: "L2", uld: "AKE-2222", weight: 1200, commodity: "General", status: "loaded", priority: "Normal" },
      { pos: "L3", uld: "AKE-3333", weight: 560, commodity: "Pharma", status: "loaded", priority: "Critical" },
      { pos: "L4", uld: "AKE-4444", weight: 780, commodity: "Courier", status: "loading", priority: "High" },
      { pos: "L5", uld: "RKN-5555", weight: 450, commodity: "Cool Chain", status: "planned", priority: "High" },
      { pos: "L6", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L7", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L8", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L9", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L10", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
    ],
    totalWeight: 17610,
    fwdCG: 28.4,
    aftCG: 31.2,
  },
  "ET512": {
    main: [],
    lower: [
      { pos: "L1", uld: "AKE-6666", weight: 1100, commodity: "General", status: "loaded", priority: "Normal" },
      { pos: "L2", uld: "AKE-7777", weight: 890, commodity: "Electronics", status: "loaded", priority: "High" },
      { pos: "L3", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L4", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L5", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L6", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L7", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L8", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L9", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L10", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L11", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L12", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L13", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L14", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L15", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L16", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
    ],
    totalWeight: 1990,
    fwdCG: 24.1,
    aftCG: 26.8,
  },
  "ET302": {
    main: [
      { pos: "P1", uld: "PMC-2233", weight: 5100, commodity: "General", status: "loaded", priority: "Normal" },
      { pos: "P2", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "P3", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "P4", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "P5", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "P6", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
    ],
    lower: [
      { pos: "L1", uld: "AKE-8888", weight: 670, commodity: "Courier", status: "loaded", priority: "High" },
      { pos: "L2", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L3", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L4", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L5", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L6", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L7", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L8", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L9", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
      { pos: "L10", uld: "", weight: 0, commodity: "", status: "empty", priority: "" },
    ],
    totalWeight: 5770,
    fwdCG: 22.0,
    aftCG: 24.5,
  },
}

const aiRecommendations = [
  { type: "revenue", text: "Replace General Cargo on P3 with waitlisted Pharma — adds $4,200 revenue", action: "Apply" },
  { type: "balance", text: "Move PMC on P4 to P6 for better CG balance — reduces aft CG by 1.2%", action: "Apply" },
  { type: "warning", text: "AWB 057-78901234 (DG Class 3) cannot be next to cool chain cargo on L5", action: "Review" },
  { type: "insight", text: "12 BOM shipments likely arriving 4hrs early — reserve provisional space on L6-L7", action: "Reserve" },
  { type: "revenue", text: "Consolidate L6+L7 into one PMC — improves utilization by 23%", action: "Apply" },
]

export default function LoadPlanningPage() {
  const [selectedFlight, setSelectedFlight] = useState("ET608")
  const [queueTab, setQueueTab] = useState<"ready"|"priority"|"waitlist">("ready")
  const [autoBuilding, setAutoBuilding] = useState(false)
  const [autoBuilt, setAutoBuilt] = useState(false)

  const flight = flights.find(f => f.id === selectedFlight)!
  const plan = aircraftPositions[selectedFlight as keyof typeof aircraftPositions]
  const utilization = Math.round((plan.totalWeight / flight.maxPayload) * 100)
  const loadedMain = plan.main.filter(p => p.status !== "empty").length
  const loadedLower = plan.lower.filter(p => p.status !== "empty").length
  const revenue = Math.round(plan.totalWeight * 4.2 / 1000) * 1000

  const posStyle: Record<string, string> = {
    loaded: "bg-green-500/20 border-green-500/50 text-green-300",
    loading: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",
    planned: "bg-blue-500/20 border-blue-500/50 text-blue-300",
    empty: "bg-white/5 border-white/10 text-gray-600",
  }

  const priorityDot: Record<string, string> = {
    "Critical": "bg-red-500",
    "Must Fly": "bg-purple-500",
    "High": "bg-orange-400",
    "Normal": "bg-gray-500",
    "": "bg-transparent",
  }

  const priorityBadge: Record<string, string> = {
    "Must Fly": "bg-purple-500/20 text-purple-400",
    "Critical": "bg-red-500/20 text-red-400",
    "High": "bg-orange-500/20 text-orange-400",
    "Normal": "bg-gray-500/20 text-gray-400",
  }

  const recStyle: Record<string, string> = {
    revenue: "border-green-500/30 bg-green-500/5",
    balance: "border-blue-500/30 bg-blue-500/5",
    warning: "border-red-500/30 bg-red-500/5",
    insight: "border-yellow-500/30 bg-yellow-500/5",
  }

  const recIcon: Record<string, string> = {
    revenue: "💰", balance: "⚖️", warning: "⚠️", insight: "🔮",
  }

  const handleAutoBuild = () => {
    setAutoBuilding(true)
    setTimeout(() => { setAutoBuilding(false); setAutoBuilt(true) }, 2500)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Load Planning</h1>
          <p className="text-gray-400 text-sm mt-1">AI-powered aircraft load optimization</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold">Load Sheet</button>
          <button
            onClick={handleAutoBuild}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (autoBuilt ? "bg-green-500 text-white" : "bg-purple-600 text-white hover:bg-purple-500")}
          >
            {autoBuilding ? "🤖 Building..." : autoBuilt ? "✓ Auto-Built!" : "🤖 Auto Build Aircraft"}
          </button>
          <button className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg text-sm">Finalize Plan</button>
        </div>
      </div>

      {/* Flight Selector */}
      <div className="flex gap-3 mb-4">
        {flights.map(f => (
          <button key={f.id} onClick={() => { setSelectedFlight(f.id); setAutoBuilt(false) }}
            className={"px-4 py-3 rounded-xl border text-left transition-all " +
              (selectedFlight === f.id ? "border-yellow-500 bg-yellow-500/10" : "border-white/10 bg-[#141414]")}>
            <p className={"font-bold text-sm " + (selectedFlight === f.id ? "text-yellow-400" : "text-white")}>{f.id}</p>
            <p className="text-xs text-gray-400">{f.route} · {f.aircraft}</p>
            <p className="text-xs text-gray-500">{f.reg}</p>
          </button>
        ))}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {[
          { label: "Payload Used", value: `${(plan.totalWeight/1000).toFixed(1)}T`, sub: `of ${(flight.maxPayload/1000).toFixed(0)}T`, color: "text-white" },
          { label: "Utilization", value: `${utilization}%`, sub: "payload fill", color: utilization > 85 ? "text-green-400" : utilization > 60 ? "text-yellow-400" : "text-red-400" },
          { label: "Main Deck", value: `${loadedMain}/${flight.mainSlots}`, sub: "positions filled", color: "text-blue-400" },
          { label: "Lower Deck", value: `${loadedLower}/${flight.lowerSlots}`, sub: "positions filled", color: "text-purple-400" },
          { label: "Est. Revenue", value: `$${(revenue/1000).toFixed(0)}K`, sub: "at $4.2/kg avg", color: "text-green-400" },
          { label: "CG Status", value: plan.fwdCG < 30 ? "Normal" : "Check", sub: `FWD ${plan.fwdCG}% AFT ${plan.aftCG}%`, color: "text-green-400" },
        ].map((k, i) => (
          <div key={i} className="bg-[#141414] rounded-xl border border-white/5 p-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{k.label}</p>
            <p className={"text-lg font-bold " + k.color}>{k.value}</p>
            <p className="text-gray-500 text-xs">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Main 3-column layout */}
      <div className="grid grid-cols-12 gap-4">

        {/* LEFT — Shipment Queue */}
        <div className="col-span-3">
          <div className="bg-[#141414] rounded-xl border border-white/5 h-full">
            <div className="p-4 border-b border-white/5">
              <p className="text-white font-semibold text-sm">Shipment Queue</p>
              <div className="flex gap-1 mt-3">
                {(["ready","priority","waitlist"] as const).map(t => (
                  <button key={t} onClick={() => setQueueTab(t)}
                    className={"flex-1 py-1 rounded text-xs font-medium transition-all capitalize " +
                      (queueTab === t ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
              {shipmentQueue[queueTab].map((s, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-yellow-400 text-xs font-semibold">{s.awb.slice(-8)}</span>
                    <span className={"px-1.5 py-0.5 rounded text-xs " + priorityBadge[s.priority]}>{s.priority}</span>
                  </div>
                  <p className="text-white text-xs font-medium">{s.commodity}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-400 text-xs">{s.weight}kg · {s.pieces}pcs</span>
                    <span className="text-green-400 text-xs">${s.yield}/kg</span>
                  </div>
                  {s.dg && <span className="text-red-400 text-xs">⚠ DG</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — Aircraft Visual */}
        <div className="col-span-6">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">{selectedFlight} — {flight.aircraft} ({flight.reg})</p>
              <div className="flex gap-2 text-xs">
                {[["bg-green-500","Loaded"],["bg-yellow-500","Loading"],["bg-blue-500","Planned"],["bg-white/20","Empty"]].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1">
                    <div className={"w-2 h-2 rounded-sm " + c}></div>
                    <span className="text-gray-400">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nose indicator */}
            <div className="flex items-center gap-2 mb-2">
              <div className="text-gray-500 text-xs">✈ NOSE</div>
              <div className="flex-1 h-px bg-white/10"></div>
              <div className="text-gray-500 text-xs">TAIL</div>
            </div>

            {/* Main Deck */}
            {plan.main.length > 0 && (
              <div className="mb-4">
                <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Main Deck</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${plan.main.length}, 1fr)` }}>
                  {plan.main.map((pos) => (
                    <div key={pos.pos}
                      className={"border rounded-lg p-2 text-center cursor-pointer hover:opacity-80 transition-all " + posStyle[pos.status]}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{pos.pos}</span>
                        {pos.priority && <div className={"w-2 h-2 rounded-full " + priorityDot[pos.priority]}></div>}
                      </div>
                      {pos.uld ? (
                        <>
                          <p className="text-xs font-medium truncate">{pos.uld.split("-")[0]}</p>
                          <p className="text-xs opacity-70 mt-0.5">{pos.commodity}</p>
                          <p className="text-xs opacity-60">{pos.weight}kg</p>
                        </>
                      ) : (
                        <p className="text-xs mt-2 opacity-30">Empty</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lower Deck */}
            <div>
              <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Lower Deck</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(plan.lower.length, 5)}, 1fr)` }}>
                {plan.lower.map((pos) => (
                  <div key={pos.pos}
                    className={"border rounded-lg p-2 text-center cursor-pointer hover:opacity-80 transition-all " + posStyle[pos.status]}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{pos.pos}</span>
                      {pos.priority && <div className={"w-2 h-2 rounded-full " + priorityDot[pos.priority]}></div>}
                    </div>
                    {pos.uld ? (
                      <>
                        <p className="text-xs font-medium truncate">{pos.uld.split("-")[0]}</p>
                        <p className="text-xs opacity-70 mt-0.5">{pos.commodity}</p>
                        <p className="text-xs opacity-60">{pos.weight}kg</p>
                      </>
                    ) : (
                      <p className="text-xs mt-1 opacity-30">Empty</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CG Bar */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Center of Gravity</span>
                <span className="text-green-400">✓ Within Limits</span>
              </div>
              <div className="relative h-4 bg-white/5 rounded-full overflow-hidden">
                <div className="absolute inset-0 flex">
                  <div className="bg-red-500/30 h-full" style={{width:"15%"}}></div>
                  <div className="bg-green-500/10 h-full flex-1"></div>
                  <div className="bg-red-500/30 h-full" style={{width:"15%"}}></div>
                </div>
                <div className="absolute top-0.5 h-3 w-1.5 bg-yellow-400 rounded-full" style={{left: plan.fwdCG + "%"}}></div>
                <div className="absolute top-0.5 h-3 w-1.5 bg-blue-400 rounded-full" style={{left: plan.aftCG + "%"}}></div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-yellow-400">FWD {plan.fwdCG}%</span>
                <span className="text-blue-400">AFT {plan.aftCG}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — AI Panel */}
        <div className="col-span-3">
          <div className="bg-[#141414] rounded-xl border border-white/5 h-full">
            <div className="p-4 border-b border-white/5">
              <p className="text-white font-semibold text-sm">🤖 AI Recommendations</p>
              <p className="text-gray-400 text-xs mt-1">{aiRecommendations.length} active suggestions</p>
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
              {aiRecommendations.map((r, i) => (
                <div key={i} className={"border rounded-lg p-3 " + recStyle[r.type]}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm shrink-0">{recIcon[r.type]}</span>
                    <p className="text-gray-300 text-xs flex-1">{r.text}</p>
                  </div>
                  <button className="mt-2 w-full bg-white/10 hover:bg-white/20 text-white text-xs py-1 rounded transition-colors">
                    {r.action}
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/5">
              <p className="text-gray-400 text-xs font-medium mb-2">Revenue Opportunity</p>
              <p className="text-green-400 text-lg font-bold">+$12,400</p>
              <p className="text-gray-500 text-xs">If all AI suggestions applied</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}