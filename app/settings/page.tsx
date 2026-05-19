"use client"
import { useState } from "react"

export default function SettingsPage() {
  const [station, setStation] = useState("ADD")
  const [airline, setAirline] = useState("Ethiopian Airlines")
  const [timezone, setTimezone] = useState("Africa/Addis_Ababa")
  const [weightUnit, setWeightUnit] = useState("KG")
  const [notifications, setNotifications] = useState(true)
  const [dgAlerts, setDgAlerts] = useState(true)
  const [aiSuggestions, setAiSuggestions] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={"relative w-11 h-6 rounded-full transition-all " + (value ? "bg-yellow-500" : "bg-white/20")}>
      <div className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all " + (value ? "left-5" : "left-0.5")}></div>
    </button>
  )

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">System configuration and preferences</p>
        </div>
        <button onClick={handleSave}
          className={"px-4 py-2 rounded-lg text-sm font-semibold transition-all " + (saved ? "bg-green-500 text-white" : "bg-yellow-500 text-black")}>
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Station Info */}
      <div className="bg-[#141414] rounded-xl border border-white/5 p-5 mb-4">
        <p className="text-white font-semibold mb-4">Station Configuration</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Station Code</label>
            <input value={station} onChange={e => setStation(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Airline</label>
            <input value={airline} onChange={e => setAirline(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500">
              <option value="Africa/Addis_Ababa">Africa/Addis_Ababa (EAT)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-2">Weight Unit</label>
            <div className="flex gap-2">
              {["KG", "LB"].map(u => (
                <button key={u} onClick={() => setWeightUnit(u)}
                  className={"flex-1 py-2 rounded-lg text-sm font-semibold transition-all " + (weightUnit === u ? "bg-yellow-500 text-black" : "bg-white/5 text-gray-400")}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-[#141414] rounded-xl border border-white/5 p-5 mb-4">
        <p className="text-white font-semibold mb-4">Notifications & Alerts</p>
        <div className="space-y-4">
          {[
            { label: "Live Notifications", desc: "Real-time operational alerts", value: notifications, onChange: () => setNotifications(!notifications) },
            { label: "DG Alerts", desc: "Dangerous goods conflict warnings", value: dgAlerts, onChange: () => setDgAlerts(!dgAlerts) },
            { label: "AI Suggestions", desc: "Smart optimization recommendations", value: aiSuggestions, onChange: () => setAiSuggestions(!aiSuggestions) },
            { label: "Auto Save", desc: "Automatically save load plans", value: autoSave, onChange: () => setAutoSave(!autoSave) },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{item.label}</p>
                <p className="text-gray-400 text-xs">{item.desc}</p>
              </div>
              <Toggle value={item.value} onChange={item.onChange} />
            </div>
          ))}
        </div>
      </div>

      {/* User Roles */}
      <div className="bg-[#141414] rounded-xl border border-white/5 p-5 mb-4">
        <p className="text-white font-semibold mb-4">Team & Roles</p>
        <div className="space-y-3">
          {[
            { name: "Asnakegi", role: "Admin", email: "admin@adeyiq.com", status: "Active" },
            { name: "Load Master 1", role: "Loadmaster", email: "lm1@adeyiq.com", status: "Active" },
            { name: "Cargo Agent 1", role: "Cargo Agent", email: "agent1@adeyiq.com", status: "Active" },
            { name: "DG Officer", role: "DG Officer", email: "dg@adeyiq.com", status: "Inactive" },
          ].map((u, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <span className="text-yellow-400 text-xs font-bold">{u.name[0]}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{u.name}</p>
                  <p className="text-gray-400 text-xs">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-300 text-xs bg-white/10 px-2 py-1 rounded">{u.role}</span>
                <span className={"text-xs px-2 py-1 rounded " + (u.status === "Active" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400")}>{u.status}</span>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-3 w-full border border-dashed border-white/20 text-gray-400 text-sm py-2 rounded-lg hover:bg-white/5 transition-colors">
          + Invite Team Member
        </button>
      </div>

      {/* System Info */}
      <div className="bg-[#141414] rounded-xl border border-white/5 p-5">
        <p className="text-white font-semibold mb-4">System Information</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Version", value: "AdeyIQ v0.1.0" },
            { label: "Environment", value: "Development" },
            { label: "Database", value: "Not connected" },
            { label: "AI Engine", value: "Claude Sonnet" },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-3">
              <p className="text-gray-400 text-xs">{s.label}</p>
              <p className="text-white text-sm font-medium mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}