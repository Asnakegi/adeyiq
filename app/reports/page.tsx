"use client"
import { useState } from "react"

const flightRevenue = [
  { flight: "ET608", route: "ADD→DXB", revenue: 145000, prorated: 82000, yield: 4.5, ulds: 11, utilization: 91, score: 92 },
  { flight: "ET847", route: "ADD→FRA", revenue: 128000, prorated: 71000, yield: 3.8, ulds: 8, utilization: 84, score: 85 },
  { flight: "ET302", route: "ADD→HKG", revenue: 119000, prorated: 68000, yield: 4.1, ulds: 11, utilization: 71, score: 76 },
  { flight: "ET512", route: "ADD→LHR", revenue: 156000, prorated: 91000, yield: 5.2, ulds: 9, utilization: 96, score: 94 },
  { flight: "ET204", route: "ADD→NBO", revenue: 48000, prorated: 31000, yield: 2.1, ulds: 2, utilization: 62, score: 61 },
  { flight: "ET717", route: "ADD→PVG", revenue: 132000, prorated: 74000, yield: 4.3, ulds: 10, utilization: 79, score: 81 },
]

const proratedRoutes = [
  { origin: "CAN", dest: "LOS", awbs: 120, weight: "15,000kg", revenue: 45000, contribution: 38 },
  { origin: "HKG", dest: "LOS", awbs: 80, weight: "10,000kg", revenue: 30000, contribution: 25 },
  { origin: "BOM", dest: "LOS", awbs: 60, weight: "7,000kg", revenue: 18000, contribution: 15 },
  { origin: "ADD", dest: "DXB", awbs: 95, weight: "12,000kg", revenue: 36000, contribution: 30 },
  { origin: "ADD", dest: "LHR", awbs: 110, weight: "14,000kg", revenue: 52000, contribution: 44 },
]

const buildMix = [
  { type: "General Cargo", pieces: "45%", weight: "40T", revenue: 80000, efficiency: "Medium", color: "bg-blue-500" },
  { type: "Pharma", pieces: "15%", weight: "8T", revenue: 60000, efficiency: "Very High", color: "bg-green-500" },
  { type: "Courier", pieces: "20%", weight: "12T", revenue: 50000, efficiency: "High", color: "bg-yellow-500" },
  { type: "Perishable", pieces: "10%", weight: "20T", revenue: 30000, efficiency: "Low", color: "bg-orange-500" },
  { type: "Dangerous Goods", pieces: "10%", weight: "5T", revenue: 25000, efficiency: "High", color: "bg-red-500" },
]

const aiRecommendations = [
  { type: "opportunity", text: "Increase allocation for CAN→LOS next week due to high yield trend (+18%)", impact: "High" },
  { type: "warning", text: "PMC utilization on ET507 dropped 12% below normal — investigate build quality", impact: "Medium" },
  { type: "insight", text: "Courier cargo gives 18% better yield than general cargo on LHR route", impact: "High" },
  { type: "insight", text: "HKG shipments generate highest revenue density at $5.2/kg", impact: "High" },
  { type: "warning", text: "Flight ET204 has high dead space risk — 38% empty capacity predicted", impact: "Critical" },
  { type: "opportunity", text: "Pharma demand forecast up 22% next month — allocate more RKN/RAP ULDs", impact: "High" },
]

const riskData = [
  { risk: "Offload Risk", flight: "ET512", level: "High", detail: "Overbooking 103% — main deck" },
  { risk: "ULD Shortage", flight: "ET608", level: "Medium", detail: "PMC availability dropping" },
  { risk: "Low Yield", flight: "ET204", level: "High", detail: "Yield 2.1/kg vs 4.2/kg average" },
  { risk: "Dead Space", flight: "ET302", level: "Medium", detail: "29% unused capacity predicted" },
]

const monthlyTrend = [
  { month: "Nov", revenue: 2.1 }, { month: "Dec", revenue: 2.8 },
  { month: "Jan", revenue: 2.4 }, { month: "Feb", revenue: 3.1 },
  { month: "Mar", revenue: 2.9 }, { month: "Apr", revenue: 3.4 },
  { month: "May", revenue: 3.2 },
]

const tabs = ["Executive", "Flight Revenue", "Prorated", "Build Mix", "AI Insights", "Risk"]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("Executive")
  const maxRevenue = Math.max(...monthlyTrend.map(d => d.revenue))
  const totalRevenue = flightRevenue.reduce((s, f) => s + f.revenue, 0)
  const avgYield = (flightRevenue.reduce((s, f) => s + f.yield, 0) / flightRevenue.length).toFixed(1)
  const avgUtil = Math.round(flightRevenue.reduce((s, f) => s + f.utilization, 0) / flightRevenue.length)
  const avgScore = Math.round(flightRevenue.reduce((s, f) => s + f.score, 0) / flightRevenue.length)

  const scoreColor = (s: number) => s >= 90 ? "text-green-400" : s >= 75 ? "text-yellow-400" : "text-red-400"
  const impactBg: Record<string, string> = {
    "Critical": "bg-red-500/20 text-red-400",
    "High": "bg-orange-500/20 text-orange-400",
    "Medium": "bg-yellow-500/20 text-yellow-400",
  }
  const typeBg: Record<string, string> = {
    "opportunity": "bg-green-500/20 text-green-400",
    "warning": "bg-red-500/20 text-red-400",
    "insight": "bg-blue-500/20 text-blue-400",
  }
  const riskBg: Record<string, string> = {
    "High": "bg-red-500/20 text-red-400",
    "Medium": "bg-yellow-500/20 text-yellow-400",
    "Low": "bg-green-500/20 text-green-400",
    "Critical": "bg-red-500/20 text-red-400",
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">AI-powered cargo intelligence platform</p>
        </div>
        <button className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg text-sm">Export Report</button>
      </div>

      {/* Executive KPIs - Always Visible */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total Revenue", value: "$728K", sub: "↑ 12% vs last month", color: "text-white" },
          { label: "Revenue/Flight", value: "$121K", sub: "Avg per flight", color: "text-yellow-400" },
          { label: "Avg Yield/kg", value: `$${avgYield}`, sub: "Chargeable weight", color: "text-green-400" },
          { label: "ULD Utilization", value: `${avgUtil}%`, sub: "Across all flights", color: "text-blue-400" },
          { label: "AI Flight Score", value: `${avgScore}/100`, sub: "Avg performance", color: "text-purple-400" },
          { label: "Build Efficiency", value: "87%", sub: "Space optimization", color: "text-orange-400" },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#141414] rounded-xl border border-white/5 p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className={"text-xl font-bold " + kpi.color}>{kpi.value}</p>
            <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === t ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}>
            {t}
          </button>
        ))}
      </div>

      {/* Executive Tab */}
      {activeTab === "Executive" && (
        <div className="space-y-4">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-5">
            <p className="text-white font-semibold mb-6">Revenue Trend (USD Millions)</p>
            <div className="flex items-end gap-3 h-40">
              {monthlyTrend.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                  <p className="text-gray-400 text-xs">${d.revenue}M</p>
                  <div className="w-full bg-white/5 rounded-t-lg relative" style={{ height: "120px" }}>
                    <div className="absolute bottom-0 w-full bg-yellow-500 rounded-t-lg"
                      style={{ height: (d.revenue / maxRevenue * 100) + "%" }}></div>
                  </div>
                  <p className="text-gray-400 text-xs">{d.month}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#141414] rounded-xl border border-white/5 p-5">
              <p className="text-white font-semibold mb-4">Top Revenue Flights</p>
              <div className="space-y-3">
                {flightRevenue.sort((a,b) => b.revenue - a.revenue).slice(0,4).map((f,i) => (
                  <div key={f.flight} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-4">{i+1}</span>
                      <div>
                        <p className="text-yellow-400 text-sm font-semibold">{f.flight}</p>
                        <p className="text-gray-400 text-xs">{f.route}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-bold">${(f.revenue/1000).toFixed(0)}K</p>
                      <p className="text-gray-400 text-xs">${f.yield}/kg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#141414] rounded-xl border border-white/5 p-5">
              <p className="text-white font-semibold mb-4">AI Recommendations</p>
              <div className="space-y-2">
                {aiRecommendations.slice(0,3).map((r,i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className={"px-1.5 py-0.5 rounded text-xs font-medium shrink-0 " + typeBg[r.type]}>
                      {r.type === "opportunity" ? "↑" : r.type === "warning" ? "⚠" : "→"}
                    </span>
                    <p className="text-gray-300 text-xs">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flight Revenue Tab */}
      {activeTab === "Flight Revenue" && (
        <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-white/5 text-left">
                <th className="px-5 py-3 font-medium">FLIGHT</th>
                <th className="px-5 py-3 font-medium">ROUTE</th>
                <th className="px-5 py-3 font-medium">TOTAL REV</th>
                <th className="px-5 py-3 font-medium">PRORATED</th>
                <th className="px-5 py-3 font-medium">YIELD/KG</th>
                <th className="px-5 py-3 font-medium">ULDs</th>
                <th className="px-5 py-3 font-medium">UTILIZATION</th>
                <th className="px-5 py-3 font-medium">AI SCORE</th>
              </tr>
            </thead>
            <tbody>
              {flightRevenue.map((f) => (
                <tr key={f.flight} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 text-yellow-400 font-semibold">{f.flight}</td>
                  <td className="px-5 py-4 text-white">{f.route}</td>
                  <td className="px-5 py-4 text-green-400 font-semibold">${(f.revenue/1000).toFixed(0)}K</td>
                  <td className="px-5 py-4 text-gray-300">${(f.prorated/1000).toFixed(0)}K</td>
                  <td className="px-5 py-4 text-gray-300">${f.yield}/kg</td>
                  <td className="px-5 py-4 text-gray-300">{f.ulds}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-white/10 rounded-full">
                        <div className={"h-full rounded-full " + (f.utilization>90?"bg-green-400":f.utilization>75?"bg-yellow-400":"bg-orange-400")}
                          style={{ width: f.utilization+"%" }}></div>
                      </div>
                      <span className="text-gray-300 text-xs">{f.utilization}%</span>
                    </div>
                  </td>
                  <td className={"px-5 py-4 font-bold " + scoreColor(f.score)}>{f.score}/100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Prorated Revenue Tab */}
      {activeTab === "Prorated" && (
        <div className="space-y-4">
          <div className="bg-[#141414] rounded-xl border border-white/5 p-4 mb-2">
            <p className="text-gray-300 text-sm">Prorated revenue shows how much each origin-destination pair contributes to a multi-leg route. Essential for identifying which markets drive profitability.</p>
          </div>
          <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/5 text-left">
                  <th className="px-5 py-3 font-medium">ORIGIN</th>
                  <th className="px-5 py-3 font-medium">DESTINATION</th>
                  <th className="px-5 py-3 font-medium">AWB COUNT</th>
                  <th className="px-5 py-3 font-medium">WEIGHT</th>
                  <th className="px-5 py-3 font-medium">PRORATED REV</th>
                  <th className="px-5 py-3 font-medium">CONTRIBUTION</th>
                </tr>
              </thead>
              <tbody>
                {proratedRoutes.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4 text-yellow-400 font-bold">{r.origin}</td>
                    <td className="px-5 py-4 text-white font-bold">{r.dest}</td>
                    <td className="px-5 py-4 text-gray-300">{r.awbs}</td>
                    <td className="px-5 py-4 text-gray-300">{r.weight}</td>
                    <td className="px-5 py-4 text-green-400 font-semibold">${(r.revenue/1000).toFixed(0)}K</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-white/10 rounded-full">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: r.contribution+"%" }}></div>
                        </div>
                        <span className="text-gray-300 text-xs">{r.contribution}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Build Mix Tab */}
      {activeTab === "Build Mix" && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3 mb-2">
            {buildMix.map((b, i) => (
              <div key={i} className="bg-[#141414] rounded-xl border border-white/5 p-4">
                <div className={"w-3 h-3 rounded-full mb-2 " + b.color}></div>
                <p className="text-white text-sm font-semibold">{b.type}</p>
                <p className="text-2xl font-bold text-white mt-1">${(b.revenue/1000).toFixed(0)}K</p>
                <p className="text-gray-400 text-xs mt-1">{b.weight} · {b.pieces}</p>
                <p className={"text-xs font-medium mt-2 " + (b.efficiency==="Very High"||b.efficiency==="High"?"text-green-400":b.efficiency==="Medium"?"text-yellow-400":"text-red-400")}>{b.efficiency} Yield</p>
              </div>
            ))}
          </div>
          <div className="bg-[#141414] rounded-xl border border-white/5 p-5">
            <p className="text-white font-semibold mb-4">Revenue Distribution</p>
            <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
              {buildMix.map((b, i) => (
                <div key={i} className={b.color + " flex items-center justify-center"}
                  style={{ width: (b.revenue / buildMix.reduce((s,x)=>s+x.revenue,0) * 100)+"%" }}>
                  <span className="text-white text-xs font-bold hidden sm:block">{b.pieces}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 flex-wrap">
              {buildMix.map((b,i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={"w-2 h-2 rounded-full " + b.color}></div>
                  <span className="text-gray-400 text-xs">{b.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === "AI Insights" && (
        <div className="space-y-3">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-2">
            <p className="text-yellow-400 font-semibold text-sm">🤖 AI Cargo Co-Pilot</p>
            <p className="text-gray-300 text-xs mt-1">AI has analyzed all flight data, ULD builds, and market trends. Here are today's intelligent recommendations.</p>
          </div>
          {aiRecommendations.map((r, i) => (
            <div key={i} className="bg-[#141414] rounded-xl border border-white/5 p-4 flex gap-4 items-start">
              <span className={"px-2 py-1 rounded text-xs font-bold shrink-0 " + typeBg[r.type]}>
                {r.type === "opportunity" ? "OPPORTUNITY" : r.type === "warning" ? "WARNING" : "INSIGHT"}
              </span>
              <div className="flex-1">
                <p className="text-white text-sm">{r.text}</p>
              </div>
              <span className={"px-2 py-1 rounded text-xs font-medium shrink-0 " + impactBg[r.impact]}>{r.impact}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risk Tab */}
      {activeTab === "Risk" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-xs uppercase tracking-wider mb-1">High Risk Flights</p>
              <p className="text-3xl font-bold text-red-400">{riskData.filter(r=>r.level==="High").length}</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-yellow-400 text-xs uppercase tracking-wider mb-1">Medium Risk</p>
              <p className="text-3xl font-bold text-yellow-400">{riskData.filter(r=>r.level==="Medium").length}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-green-400 text-xs uppercase tracking-wider mb-1">Low Risk</p>
              <p className="text-3xl font-bold text-green-400">{riskData.filter(r=>r.level==="Low").length}</p>
            </div>
          </div>
          <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/5 text-left">
                  <th className="px-5 py-3 font-medium">RISK TYPE</th>
                  <th className="px-5 py-3 font-medium">FLIGHT</th>
                  <th className="px-5 py-3 font-medium">LEVEL</th>
                  <th className="px-5 py-3 font-medium">DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {riskData.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4 text-white font-semibold">{r.risk}</td>
                    <td className="px-5 py-4 text-yellow-400 font-semibold">{r.flight}</td>
                    <td className="px-5 py-4">
                      <span className={"px-2 py-1 rounded text-xs font-medium " + riskBg[r.level]}>{r.level}</span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}