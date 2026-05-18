"use client"

export default function FlightsPage() {
  const flights = [
    { id: "ET608", route: "ADD → DXB", std: "23:45", aircraft: "B777F", ulds: 11, weight: "74.2T", utilization: 91, status: "In progress" },
    { id: "ET847", route: "ADD → FRA", std: "01:10", aircraft: "B787-8", ulds: 8, weight: "62.1T", utilization: 84, status: "Completed" },
    { id: "ET302", route: "ADD → HKG", std: "02:30", aircraft: "B777F", ulds: 11, weight: "58.3T", utilization: 71, status: "Delayed" },
    { id: "ET512", route: "ADD → LHR", std: "03:55", aircraft: "B787-9", ulds: 9, weight: "81.4T", utilization: 96, status: "Critical" },
    { id: "ET204", route: "ADD → NBO", std: "06:00", aircraft: "B737-800", ulds: 2, weight: "14.8T", utilization: 62, status: "Scheduled" },
    { id: "ET717", route: "ADD → PVG", std: "08:15", aircraft: "A350-900", ulds: 10, weight: "68.9T", utilization: 79, status: "Scheduled" },
  ]

  const statusColor: Record<string, string> = {
    "In progress": "text-yellow-400",
    "Completed": "text-green-400",
    "Delayed": "text-orange-400",
    "Critical": "text-red-500",
    "Scheduled": "text-blue-400",
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Flights</h1>
          <p className="text-gray-400 text-sm mt-1">All active and scheduled cargo flights</p>
        </div>
        <button className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg text-sm">+ Add Flight</button>
      </div>
      <div className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-white/5 text-left">
              <th className="px-6 py-4 font-medium">FLIGHT</th>
              <th className="px-6 py-4 font-medium">ROUTE</th>
              <th className="px-6 py-4 font-medium">STD</th>
              <th className="px-6 py-4 font-medium">AIRCRAFT</th>
              <th className="px-6 py-4 font-medium">ULDs</th>
              <th className="px-6 py-4 font-medium">WEIGHT</th>
              <th className="px-6 py-4 font-medium">UTILIZATION</th>
              <th className="px-6 py-4 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 text-yellow-400 font-semibold">{f.id}</td>
                <td className="px-6 py-4 text-white">{f.route}</td>
                <td className="px-6 py-4 text-gray-300">{f.std}</td>
                <td className="px-6 py-4 text-gray-300">{f.aircraft}</td>
                <td className="px-6 py-4 text-gray-300">{f.ulds}</td>
                <td className="px-6 py-4 text-gray-300">{f.weight}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/10 rounded-full">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: f.utilization + "%" }}></div>
                    </div>
                    <span className="text-gray-300">{f.utilization}%</span>
                  </div>
                </td>
                <td className={"px-6 py-4 font-medium " + statusColor[f.status]}>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}