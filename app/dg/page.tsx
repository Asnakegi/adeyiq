"use client"
import { useState } from "react"

const dgAlerts = [
  { id: "DG-001", awb: "057-12345678", flight: "ET302", class: "Class 3", subclass: "Flammable Liquid", un: "UN1263", pieces: 4, weight: "120 kg", conflict: "Class 5.1", severity: "Critical", status: "On Hold" },
  { id: "DG-002", awb: "057-23456789", flight: "ET512", class: "Class 8", subclass: "Corrosive", un: "UN1824", pieces: 2, weight: "45 kg", conflict: "None", severity: "Warning", status: "Approved" },
  { id: "DG-003", awb: "057-34567890", flight: "ET608", class: "Class 2.2", subclass: "Non-Flammable Gas", un: "UN1066", pieces: 6, weight: "200 kg", conflict: "Class 2.3", severity: "Critical", status: "Rejected" },
  { id: "DG-004", awb: "057-45678901", flight: "ET847", class: "Class 6.1", subclass: "Toxic", un: "UN2810", pieces: 1, weight: "30 kg", conflict: "None", severity: "Info", status: "Approved" },
  { id: "DG-005", awb: "057-56789012", flight: "ET717", class: "Class 9", subclass: "Misc Dangerous", un: "UN3077", pieces: 8, weight: "340 kg", conflict: "None", severity: "Info", status: "Pending" },
]

const dgRules = [
  { class1: "Class 1", class2: "Class 3", allowed: false, note: "Explosives cannot be with flammables" },
  { class1: "Class 3", class2: "Class 5.1", allowed: false, note: "Flammables incompatible with oxidizers" },
  { class1: "Class 2.3", class2: "Class 2.2", allowed: false, note: "Toxic gas incompatible with non-toxic gas" },
  { class1: "Class 4.1", class2: "Class 5.1", allowed: false, note: "Flammable solids with oxidizers prohibited" },
  { class1: "Class 6.1", class2: "Class 3", allowed: true, note: "Toxic with flammables — conditional" },
  { class1: "Class 8", class2: "Class 9", allowed: true, note: "Corrosives with misc — allowed" },
]

export default function DGCompliancePage() {
  const [activeTab, setActiveTab] = useState<"alerts"|"rules">("alerts")
  const [filter, setFilter] = useState("All")

  const severityColor: Record<string, string> = {
    "Critical": "text-red-400",
    "Warning": "text-yellow-400",
    "Info": "text-blue-400",
  }

  const severityBg: Record<string, string> = {
    "Critical": "bg-red-500/20 text-red-400",
    "Warning": "bg-yellow-500/20 text-yellow-400",
    "Info": "bg-blue-500/20 text-blue-400",
  }

  const statusBg: Record<string, string> = {
    "On Hold": "bg-red-500/20 text-red-400",
    "Approved": "bg-green-500/20 text-green-400",
    "Rejected": "bg-red-500/20 text-red-400",
    "Pending": "bg-yellow-500/20 text-yellow-400",
  }

  const filtered = filter === "All" ? dgAlerts : dgAlerts.filter(a => a.severity === filter)
  const critical = dgAlerts.filter(a => a.severity === "Critical").length
  const warnings = dgAlerts.filter(a => a.severity === "Warning").length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">DG Compliance</h1>
          <p className="text-gray-400 text-sm mt-1">Dangerous goods validation and segregation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("alerts")}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "alerts" ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}
          >DG Alerts</button>
          <button
            onClick={() => setActiveTab("rules")}
            className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (activeTab === "rules" ? "bg-yellow-500 text-black" : "bg-white/10 text-white")}
          >Segregation Rules</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#141414] rounded-xl border border-white/5 p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total DG Shipments</p>
          <p className="text-2xl font-bold text-white">{dgAlerts.length}</p>
        </div>
        <div className="bg-[#141414] rounded-xl border border-red-500/20 p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Critical Alerts</p>
          <p className="text-2xl font-bold text-red-400">{critical}</p>
        </div>
        <div className="bg-[#141414] rounded-xl border border-yellow-500/20 p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Warnings</p>
          <p className="text-2xl font-bold text-yellow-400">{warnings}</p>
        </div>
        <div className="bg-[#141414] rounded-xl border border-green-500/20 p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-400">{dgAlerts.filter(a => a.status === "Approved").length}</p>
        </div>
      </div>

      {activeTab === "alerts" ? (
        <div>
          <div className="flex gap-2 mb-4">
            {["All", "Critical", "Warning", "Info"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all " + (filter === f ? "bg-yellow-500 text-black" : "bg-white/10 text-gray-300")}>
                {f}
              </button>
            ))}
          </div>
          <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/5 text-left">
                  <th className="px-5 py-3 font-medium">ALERT ID</th>
                  <th className="px-5 py-3 font-medium">AWB</th>
                  <th className="px-5 py-3 font-medium">FLIGHT</th>
                  <th className="px-5 py-3 font-medium">DG CLASS</th>
                  <th className="px-5 py-3 font-medium">UN NUMBER</th>
                  <th className="px-5 py-3 font-medium">CONFLICT</th>
                  <th className="px-5 py-3 font-medium">SEVERITY</th>
                  <th className="px-5 py-3 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3 text-yellow-400 font-semibold">{a.id}</td>
                    <td className="px-5 py-3 text-gray-300 text-xs">{a.awb}</td>
                    <td className="px-5 py-3 text-white font-medium">{a.flight}</td>
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-white text-xs font-medium">{a.class}</p>
                        <p className="text-gray-400 text-xs">{a.subclass}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-300 font-mono text-xs">{a.un}</td>
                    <td className="px-5 py-3">
                      {a.conflict !== "None"
                        ? <span className="text-red-400 text-xs font-medium">⚠ {a.conflict}</span>
                        : <span className="text-green-400 text-xs">✓ None</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={"px-2 py-1 rounded text-xs font-medium " + severityBg[a.severity]}>{a.severity}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={"px-2 py-1 rounded text-xs font-medium " + statusBg[a.status]}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-white font-semibold">IATA Segregation Rules</p>
            <p className="text-gray-400 text-xs mt-1">Dangerous goods compatibility matrix</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-white/5 text-left">
                <th className="px-5 py-3 font-medium">CLASS A</th>
                <th className="px-5 py-3 font-medium">CLASS B</th>
                <th className="px-5 py-3 font-medium">COMPATIBLE</th>
                <th className="px-5 py-3 font-medium">NOTE</th>
              </tr>
            </thead>
            <tbody>
              {dgRules.map((r, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 text-white font-medium">{r.class1}</td>
                  <td className="px-5 py-3 text-white font-medium">{r.class2}</td>
                  <td className="px-5 py-3">
                    {r.allowed
                      ? <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">✓ Allowed</span>
                      : <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-medium">✗ Prohibited</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}