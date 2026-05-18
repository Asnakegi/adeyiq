"use client"

export default function ShipmentsPage() {
  const shipments = [
    { awb: "057-12345678", origin: "ADD", dest: "DXB", weight: "1,240 kg", volume: "8.2 m³", commodity: "Perishables", priority: "High", status: "In Transit" },
    { awb: "057-23456789", origin: "ADD", dest: "FRA", weight: "890 kg", volume: "5.1 m³", commodity: "Electronics", priority: "Normal", status: "Booked" },
    { awb: "057-34567890", origin: "ADD", dest: "LHR", weight: "2,100 kg", volume: "12.4 m³", commodity: "General Cargo", priority: "Normal", status: "Build Up" },
    { awb: "057-45678901", origin: "ADD", dest: "HKG", weight: "560 kg", volume: "3.8 m³", commodity: "Pharmaceuticals", priority: "Critical", status: "On Hold" },
    { awb: "057-56789012", origin: "ADD", dest: "NBO", weight: "340 kg", volume: "2.1 m³", commodity: "Documents", priority: "Low", status: "Delivered" },
    { awb: "057-67890123", origin: "ADD", dest: "PVG", weight: "1,780 kg", volume: "9.6 m³", commodity: "Machinery", priority: "Normal", status: "In Transit" },
  ]

  const statusColor: Record<string, string> = {
    "In Transit": "text-yellow-400",
    "Booked": "text-blue-400",
    "Build Up": "text-purple-400",
    "On Hold": "text-red-400",
    "Delivered": "text-green-400",
  }

  const priorityColor: Record<string, string> = {
    "Critical": "bg-red-500/20 text-red-400",
    "High": "bg-orange-500/20 text-orange-400",
    "Normal": "bg-blue-500/20 text-blue-400",
    "Low": "bg-gray-500/20 text-gray-400",
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shipments</h1>
          <p className="text-gray-400 text-sm mt-1">142 active shipments across all flights</p>
        </div>
        <button className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg text-sm">+ New Shipment</button>
      </div>
      <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-white/5 text-left">
              <th className="px-6 py-4 font-medium">AWB</th>
              <th className="px-6 py-4 font-medium">ORIGIN</th>
              <th className="px-6 py-4 font-medium">DEST</th>
              <th className="px-6 py-4 font-medium">WEIGHT</th>
              <th className="px-6 py-4 font-medium">VOLUME</th>
              <th className="px-6 py-4 font-medium">COMMODITY</th>
              <th className="px-6 py-4 font-medium">PRIORITY</th>
              <th className="px-6 py-4 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.awb} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 text-yellow-400 font-semibold">{s.awb}</td>
                <td className="px-6 py-4 text-white">{s.origin}</td>
                <td className="px-6 py-4 text-white">{s.dest}</td>
                <td className="px-6 py-4 text-gray-300">{s.weight}</td>
                <td className="px-6 py-4 text-gray-300">{s.volume}</td>
                <td className="px-6 py-4 text-gray-300">{s.commodity}</td>
                <td className="px-6 py-4">
                  <span className={"px-2 py-1 rounded text-xs font-medium " + priorityColor[s.priority]}>{s.priority}</span>
                </td>
                <td className={"px-6 py-4 font-medium " + statusColor[s.status]}>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}