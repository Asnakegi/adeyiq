"use client"
import { useState } from "react"

const uldTypes = [
  { iata: "PG", name: "Main Deck Pallet with Net", dims: "96x238.5x96in", tare: 543, volume: 33.25, deck: "Main" },
  { iata: "PM", name: "Main Deck Pallet with Net", dims: "96x125x96in", tare: 130, volume: 17.16, deck: "Main" },
  { iata: "AM", name: "Main Deck Pallet with Net", dims: "96x125x96in", tare: 278, volume: 17.50, deck: "Main" },
  { iata: "PAJ", name: "Main Deck Pallet with Net", dims: "88x125x96in", tare: 120, volume: 15.66, deck: "Main" },
  { iata: "P1P", name: "Main Deck Pallet with Net", dims: "88x125x96in", tare: 120, volume: 15.66, deck: "Main" },
  { iata: "AA", name: "Main Deck Container", dims: "88x125x96in", tare: 202, volume: 15.66, deck: "Main" },
  { iata: "AK", name: "LD3 Certified Container", dims: "60.4x61.5x64in", tare: 64, volume: 5.20, deck: "Lower" },
  { iata: "AP", name: "LD2 Lower Deck Container", dims: "47x60.4x64in", tare: 80, volume: 3.40, deck: "Lower" },
  { iata: "DP", name: "LD2 Non Certified Container", dims: "47x60.4x64in", tare: 80, volume: 3.40, deck: "Lower" },
  { iata: "AL", name: "6W Lower Deck Container", dims: "60.4x125x64in", tare: 160, volume: 8.77, deck: "Lower" },
  { iata: "PL", name: "Pallet with Net", dims: "60.4x125x64in", tare: 91, volume: 6.94, deck: "Lower" },
  { iata: "RAP", name: "OPTICOOLER RAP (LD9)", dims: "88x125x66in", tare: 1140, volume: 9.60, deck: "Lower" },
  { iata: "RKN", name: "RKN Electronic Cooling", dims: "60.4x61.5x64in", tare: 635, volume: 4.50, deck: "Lower" },
  { iata: "CLD", name: "T2 CLD Dry Ice Container", dims: "88x125x66in", tare: 72, volume: 9.60, deck: "Lower" },
  { iata: "RGX", name: "RGX Container", dims: "6058x2438x2755mm", tare: 3050, volume: 0, deck: "Main" },
  { iata: "RL", name: "LD11 Releye RLP", dims: "60.4x125in", tare: 880, volume: 0, deck: "Lower" },
]

const activeULDs = [
  {
    id: "PMC-1234-ET", iata: "PM", maxWeight: 6804,
    items: [
      { awb: "057-12345678", commodity: "Perishables", weight: 1240, pieces: 12 },
      { awb: "057-23456789", commodity: "Electronics", weight: 890, pieces: 6 },
      { awb: "057-34567890", commodity: "General Cargo", weight: 1100, pieces: 8 },
    ],
  },
  {
    id: "AKE-5678-ET", iata: "AK", maxWeight: 1588,
    items: [
      { awb: "057-45678901", commodity: "Pharmaceuticals", weight: 560, pieces: 4 },
      { awb: "057-56789012", commodity: "Documents", weight: 340, pieces: 20 },
    ],
  },
  {
    id: "RAP-9012-ET", iata: "RAP", maxWeight: 1588,
    items: [
      { awb: "057-67890123", commodity: "Cool Chain Cargo", weight: 780, pieces: 3 },
    ],
  },
]

export default function ULDBuilderPage() {
  const [selected, setSelected] = useState(0)
  const [activeTab, setActiveTab] = useState<"builder"|"catalog">("builder")
  const [deckFilter, setDeckFilter] = useState("All")

  const uld = activeULDs[selected]
  const totalWeight = uld.items.reduce((sum, i) => sum + i.weight, 0)
  const utilization = Math.round((totalWeight / uld.maxWeight) * 100)
  const utilizationColor = utilization > 90 ? "bg-red-500" : utilization > 75 ? "bg-yellow-400" : "bg-green-500"
  const utilizationText = utilization > 90 ? "text-red-400" : utilization > 75 ? "text-yellow-400" : "text-green-400"

  const filtered = deckFilter === "All" ? uldTypes : uldTypes.filter(u => u.deck === deckFilter)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">ULD Builder</h1>
          <p className="text-gray-400 text-sm mt-1">IATA certified Unit Load Device management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("builder")}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "builder" ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}
          >ULD Builder</button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "catalog" ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}
          >ULD Catalog</button>
        </div>
      </div>

      {activeTab === "catalog" ? (
        <div>
          <div className="flex gap-2 mb-4">
            {["All", "Main", "Lower"].map(d => (
              <button key={d} onClick={() => setDeckFilter(d)}
                className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all " + (deckFilter === d ? "bg-yellow-500 text-black" : "bg-white/10 text-gray-300")}>
                {d} Deck
              </button>
            ))}
          </div>
          <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/5 text-left">
                  <th className="px-5 py-3 font-medium">IATA CODE</th>
                  <th className="px-5 py-3 font-medium">NAME</th>
                  <th className="px-5 py-3 font-medium">DIMENSIONS</th>
                  <th className="px-5 py-3 font-medium">TARE (kg)</th>
                  <th className="px-5 py-3 font-medium">VOLUME (m³)</th>
                  <th className="px-5 py-3 font-medium">DECK</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 text-yellow-400 font-bold">{u.iata}</td>
                    <td className="px-5 py-3 text-white">{u.name}</td>
                    <td className="px-5 py-3 text-gray-300 text-xs">{u.dims}</td>
                    <td className="px-5 py-3 text-gray-300">{u.tare}</td>
                    <td className="px-5 py-3 text-gray-300">{u.volume > 0 ? u.volume : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={"px-2 py-1 rounded text-xs font-medium " + (u.deck === "Main" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400")}>
                        {u.deck}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
              <p className="text-gray-400 text-xs font-medium mb-3 uppercase tracking-wider">Active ULDs</p>
              <div className="space-y-2">
                {activeULDs.map((u, i) => {
                  const w = u.items.reduce((s, x) => s + x.weight, 0)
                  const pct = Math.round((w / u.maxWeight) * 100)
                  return (
                    <div key={u.id} onClick={() => setSelected(i)}
                      className={"p-3 rounded-lg cursor-pointer border transition-all " + (selected === i ? "border-yellow-500 bg-yellow-500/10" : "border-white/5 hover:bg-white/5")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-semibold">{u.id}</span>
                        <span className="text-xs text-yellow-400">{u.iata}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full mb-1">
                        <div className={"h-full rounded-full " + (pct > 90 ? "bg-red-500" : pct > 75 ? "bg-yellow-400" : "bg-green-500")} style={{ width: pct + "%" }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>{w} kg</span><span>{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="col-span-9 space-y-4">
            <div className="bg-[#141414] rounded-xl border border-white/5 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-white text-lg font-bold">{uld.id}</h2>
                  <p className="text-gray-400 text-sm">IATA: {uld.iata} · Max Payload: {uld.maxWeight} kg</p>
                </div>
                <div className="text-right">
                  <p className={"text-3xl font-bold " + utilizationText}>{utilization}%</p>
                  <p className="text-gray-400 text-xs">Utilization</p>
                </div>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full">
                <div className={"h-full rounded-full transition-all " + utilizationColor} style={{ width: utilization + "%" }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{totalWeight} kg loaded</span>
                <span>{uld.maxWeight - totalWeight} kg remaining</span>
              </div>
            </div>

            <div className="bg-[#141414] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs font-medium mb-4 uppercase tracking-wider">ULD Visualization</p>
              <div className="border-2 border-yellow-500/40 rounded-lg p-3 bg-yellow-500/5">
                <div className="grid grid-cols-3 gap-2">
                  {uld.items.map((item, i) => {
                    const colors = ["bg-blue-500/30 border-blue-500/50", "bg-purple-500/30 border-purple-500/50", "bg-green-500/30 border-green-500/50"]
                    return (
                      <div key={i} className={"border rounded-lg p-3 " + colors[i % 3]}>
                        <p className="text-white text-xs font-semibold truncate">{item.commodity}</p>
                        <p className="text-gray-300 text-xs">{item.weight} kg</p>
                        <p className="text-gray-400 text-xs">{item.pieces} pcs</p>
                      </div>
                    )
                  })}
                  <div className="border border-dashed border-white/20 rounded-lg p-3 flex items-center justify-center cursor-pointer hover:bg-white/5">
                    <span className="text-gray-500 text-xs">+ Add cargo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
                <p className="text-white font-semibold">Cargo Items</p>
                <button className="text-xs bg-yellow-500 text-black px-3 py-1.5 rounded-lg font-semibold">+ Add Item</button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-white/5 text-left">
                    <th className="px-5 py-3 font-medium">AWB</th>
                    <th className="px-5 py-3 font-medium">COMMODITY</th>
                    <th className="px-5 py-3 font-medium">WEIGHT</th>
                    <th className="px-5 py-3 font-medium">PIECES</th>
                    <th className="px-5 py-3 font-medium">SHARE</th>
                  </tr>
                </thead>
                <tbody>
                  {uld.items.map((item, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-yellow-400 font-semibold">{item.awb}</td>
                      <td className="px-5 py-3 text-white">{item.commodity}</td>
                      <td className="px-5 py-3 text-gray-300">{item.weight} kg</td>
                      <td className="px-5 py-3 text-gray-300">{item.pieces}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: Math.round((item.weight / totalWeight) * 100) + "%" }}></div>
                          </div>
                          <span className="text-gray-400 text-xs">{Math.round((item.weight / totalWeight) * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}