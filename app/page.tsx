"use client";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type FlightStatus = "completed" | "in_progress" | "delayed" | "scheduled" | "critical";
type AlertLevel   = "critical" | "warning" | "info";
type NavItem      = "dashboard" | "flights" | "shipments" | "uld" | "3d" | "planning" | "dg" | "reports" | "settings";

interface Flight {
  id: string; number: string; route: string; origin: string; dest: string;
  std: string; aircraft: string; ulds: number; weight: string;
  util: number; status: FlightStatus;
}

interface Alert {
  id: string; level: AlertLevel; flight: string;
  title: string; time: string;
}

// ── Static data ────────────────────────────────────────────────────────────
const FLIGHTS: Flight[] = [
  { id:"1", number:"ET608", route:"ADD → DXB", origin:"ADD", dest:"DXB", std:"23:45", aircraft:"B777F",  ulds:11, weight:"74.2T", util:91, status:"in_progress" },
  { id:"2", number:"ET847", route:"ADD → FRA", origin:"ADD", dest:"FRA", std:"01:10", aircraft:"B787-8", ulds:8,  weight:"62.1T", util:84, status:"completed" },
  { id:"3", number:"ET302", route:"ADD → HKG", origin:"ADD", dest:"HKG", std:"02:30", aircraft:"B777F",  ulds:11, weight:"58.3T", util:71, status:"delayed" },
  { id:"4", number:"ET512", route:"ADD → LHR", origin:"ADD", dest:"LHR", std:"03:55", aircraft:"B787-9", ulds:9,  weight:"81.4T", util:96, status:"critical" },
  { id:"5", number:"ET204", route:"ADD → NBO", origin:"ADD", dest:"NBO", std:"06:00", aircraft:"B737-800",ulds:2, weight:"14.8T", util:62, status:"scheduled" },
  { id:"6", number:"ET717", route:"ADD → PVG", origin:"ADD", dest:"PVG", std:"08:15", aircraft:"A350-900",ulds:10,weight:"68.9T", util:79, status:"scheduled" },
];

const ALERTS: Alert[] = [
  { id:"1", level:"critical", flight:"ET512", title:"Payload limit exceeded — main deck 103%", time:"2m ago" },
  { id:"2", level:"critical", flight:"ET302", title:"DG Class 3 + Class 5.1 conflict detected", time:"8m ago" },
  { id:"3", level:"warning",  flight:"ET608", title:"CG deviation approaching limit — recheck P7", time:"15m ago" },
  { id:"4", level:"warning",  flight:"ET717", title:"Perishable temp breach risk — FWD hold", time:"22m ago" },
  { id:"5", level:"info",     flight:"ET204", title:"Load plan approved by ground supervisor", time:"34m ago" },
];

const ULD_UTIL = [
  { type:"PMC",  total:44, loaded:38, pct:86 },
  { type:"LD3",  total:112, loaded:89, pct:79 },
  { type:"LD7",  total:28,  loaded:21, pct:75 },
  { type:"AKE",  total:36,  loaded:27, pct:75 },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const STATUS_META: Record<FlightStatus, { label:string; dot:string; bg:string; text:string }> = {
  completed:   { label:"Completed",   dot:"#22c55e", bg:"rgba(34,197,94,.12)",   text:"#22c55e" },
  in_progress: { label:"In progress", dot:"#EAB308", bg:"rgba(234,179,8,.12)",   text:"#EAB308" },
  delayed:     { label:"Delayed",     dot:"#f97316", bg:"rgba(249,115,22,.12)",   text:"#f97316" },
  scheduled:   { label:"Scheduled",   dot:"#60a5fa", bg:"rgba(96,165,250,.12)",   text:"#60a5fa" },
  critical:    { label:"Critical",    dot:"#ef4444", bg:"rgba(239,68,68,.12)",    text:"#ef4444" },
};

const ALERT_META: Record<AlertLevel, { icon:string; color:string; bg:string }> = {
  critical: { icon:"ti-alert-circle",   color:"#ef4444", bg:"rgba(239,68,68,.1)" },
  warning:  { icon:"ti-alert-triangle", color:"#f97316", bg:"rgba(249,115,22,.1)" },
  info:     { icon:"ti-info-circle",    color:"#60a5fa", bg:"rgba(96,165,250,.1)" },
};

const NAV: { id:NavItem; icon:string; label:string; badge?:number }[] = [
  { id:"dashboard", icon:"ti-layout-dashboard", label:"Dashboard" },
  { id:"flights",   icon:"ti-plane",            label:"Flights",    badge:6  },
  { id:"shipments", icon:"ti-package",           label:"Shipments",  badge:142 },
  { id:"uld",       icon:"ti-box",              label:"ULD Builder" },
  { id:"3d",        icon:"ti-3d-cube-sphere",   label:"3D View" },
  { id:"planning",  icon:"ti-calendar-stats",   label:"Load Planning" },
  { id:"dg",        icon:"ti-alert-hexagon",    label:"DG Compliance", badge:2 },
  { id:"reports",   icon:"ti-chart-bar",        label:"Reports" },
  { id:"settings",  icon:"ti-settings",         label:"Settings" },
];

// ── Subcomponents ──────────────────────────────────────────────────────────
function UtilBar({ pct, color = "#EAB308" }: { pct: number; color?: string }) {
  return (
    <div style={{ background:"rgba(255,255,255,.07)", borderRadius:99, height:6, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, background:color, height:"100%", borderRadius:99, transition:"width .4s" }} />
    </div>
  );
}

function KpiCard({ label, value, sub, accent = "#EAB308" }: {
  label:string; value:string; sub?:string; accent?:string;
}) {
  return (
    <div style={{ background:"#1a1a1a", borderRadius:16, padding:"18px 20px", border:"0.5px solid rgba(255,255,255,.08)" }}>
      <p style={{ fontSize:12, color:"#888", marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" }}>{label}</p>
      <p style={{ fontSize:28, fontWeight:700, color:accent, lineHeight:1 }}>{value}</p>
      {sub && <p style={{ fontSize:12, color:"#666", marginTop:6 }}>{sub}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Home() {
  const [activeNav, setActiveNav]     = useState<NavItem>("dashboard");
  const [selectedFlight, setFlight]   = useState<string | null>("1");
  const [sidebarOpen, setSidebar]     = useState(true);

  const criticalCount = ALERTS.filter(a => a.level === "critical").length;

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#111", color:"#fff", fontFamily:"system-ui,sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: sidebarOpen ? 220 : 64, flexShrink:0, background:"#141414",
        borderRight:"0.5px solid rgba(255,255,255,.07)", display:"flex",
        flexDirection:"column", transition:"width .2s", overflow:"hidden",
      }}>
        {/* Logo */}
        <div style={{ padding:"20px 16px 16px", borderBottom:"0.5px solid rgba(255,255,255,.07)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:36, height:36, borderRadius:10, background:"#EAB308",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            }}>
              <i className="ti ti-package" style={{ fontSize:18, color:"#111" }} aria-hidden="true" />
            </div>
            {sidebarOpen && (
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"#EAB308", lineHeight:1 }}>AdeyIQ</div>
                <div style={{ fontSize:10, color:"#555", marginTop:2 }}>Cargo Operations</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex:1, padding:"10px 8px", overflowY:"auto" }}>
          {NAV.map(n => {
            const active = activeNav === n.id;
            return (
              <button key={n.id} onClick={() => setActiveNav(n.id)} style={{
                width:"100%", display:"flex", alignItems:"center", gap:10,
                padding:"9px 10px", borderRadius:9, border:"none", cursor:"pointer",
                background: active ? "rgba(234,179,8,.12)" : "transparent",
                color: active ? "#EAB308" : "#666", marginBottom:2,
                textAlign:"left", transition:"all .12s", position:"relative",
              }}>
                <i className={`ti ${n.icon}`} style={{ fontSize:18, flexShrink:0 }} aria-hidden="true" />
                {sidebarOpen && (
                  <>
                    <span style={{ fontSize:13, fontWeight: active ? 600 : 400, flex:1 }}>{n.label}</span>
                    {n.badge != null && (
                      <span style={{
                        fontSize:10, fontWeight:700, padding:"1px 5px", borderRadius:99,
                        background: active ? "#EAB308" : "rgba(255,255,255,.1)",
                        color: active ? "#111" : "#999",
                      }}>{n.badge}</span>
                    )}
                  </>
                )}
                {!sidebarOpen && n.badge != null && (
                  <span style={{
                    position:"absolute", top:5, right:5, width:8, height:8, borderRadius:99,
                    background:"#EAB308",
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding:"12px 10px", borderTop:"0.5px solid rgba(255,255,255,.07)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:50, background:"rgba(234,179,8,.2)",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              fontSize:12, fontWeight:700, color:"#EAB308",
            }}>BT</div>
            {sidebarOpen && (
              <div style={{ overflow:"hidden" }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#ccc", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>Ben Tesfaye</div>
                <div style={{ fontSize:10, color:"#555" }}>Cargo Planner</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>

        {/* Header */}
        <header style={{
          padding:"0 24px", height:60, display:"flex", alignItems:"center",
          justifyContent:"space-between", borderBottom:"0.5px solid rgba(255,255,255,.07)",
          background:"#141414", flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <button onClick={() => setSidebar(s => !s)} style={{
              background:"transparent", border:"none", cursor:"pointer",
              color:"#555", fontSize:20, padding:4, borderRadius:6,
            }}>
              <i className="ti ti-menu-2" aria-label="Toggle sidebar" />
            </button>
            <div>
              <span style={{ fontSize:16, fontWeight:600, color:"#ddd" }}>Dashboard</span>
              <span style={{ fontSize:12, color:"#555", marginLeft:10 }}>
                {new Date().toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}
              </span>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Live badge */}
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(34,197,94,.1)", border:"0.5px solid rgba(34,197,94,.3)", borderRadius:99, padding:"5px 12px" }}>
              <span style={{ width:6, height:6, borderRadius:99, background:"#22c55e", display:"block" }} />
              <span style={{ fontSize:11, fontWeight:600, color:"#22c55e" }}>Live Operations</span>
            </div>

            {/* Alert bell */}
            <button style={{ position:"relative", background:"rgba(255,255,255,.05)", border:"0.5px solid rgba(255,255,255,.1)", borderRadius:9, padding:"7px 10px", cursor:"pointer", color:"#aaa" }}>
              <i className="ti ti-bell" style={{ fontSize:17 }} aria-label="Alerts" />
              {criticalCount > 0 && (
                <span style={{
                  position:"absolute", top:-4, right:-4, background:"#ef4444", color:"#fff",
                  fontSize:10, fontWeight:700, borderRadius:99, width:16, height:16,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>{criticalCount}</span>
              )}
            </button>

            {/* Station */}
            <div style={{ background:"rgba(234,179,8,.1)", border:"0.5px solid rgba(234,179,8,.3)", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, color:"#EAB308" }}>
              <i className="ti ti-map-pin" style={{ fontSize:13, marginRight:4 }} aria-hidden="true" />
              ADD Station
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:24 }}>
            <KpiCard label="Active flights"   value="28" sub="↑ 3 from yesterday" />
            <KpiCard label="Built ULDs"       value="124" sub="of 220 available" />
            <KpiCard label="Total cargo"      value="96.4T" sub="chargeable weight" />
            <KpiCard label="Space utilization" value="84%" sub="across all flights" accent="#22c55e" />
            <KpiCard label="DG alerts"        value="2" sub="require action" accent="#ef4444" />
            <KpiCard label="Load plans open"  value="11" sub="6 approved today" accent="#60a5fa" />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:16, marginBottom:16 }}>

            {/* Flight table */}
            <div style={{ background:"#1a1a1a", borderRadius:16, border:"0.5px solid rgba(255,255,255,.08)", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"0.5px solid rgba(255,255,255,.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:14, fontWeight:600, color:"#ddd" }}>
                  <i className="ti ti-plane" style={{ marginRight:8, color:"#EAB308" }} aria-hidden="true" />
                  Today's cargo flights
                </span>
                <button style={{ fontSize:11, color:"#EAB308", background:"transparent", border:"0.5px solid rgba(234,179,8,.3)", borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>
                  View all
                </button>
              </div>

              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ background:"rgba(255,255,255,.03)" }}>
                      {["Flight","Route","STD","Aircraft","ULDs","Weight","Utilization","Status"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", color:"#555", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FLIGHTS.map(f => {
                      const m = STATUS_META[f.status];
                      const selected = selectedFlight === f.id;
                      return (
                        <tr key={f.id} onClick={() => setFlight(f.id)} style={{
                          cursor:"pointer",
                          background: selected ? "rgba(234,179,8,.06)" : "transparent",
                          borderBottom:"0.5px solid rgba(255,255,255,.05)",
                          transition:"background .12s",
                        }}>
                          <td style={{ padding:"12px 14px", fontWeight:700, color:"#EAB308" }}>{f.number}</td>
                          <td style={{ padding:"12px 14px", color:"#ccc" }}>{f.route}</td>
                          <td style={{ padding:"12px 14px", color:"#888", fontFamily:"monospace" }}>{f.std}</td>
                          <td style={{ padding:"12px 14px", color:"#888" }}>{f.aircraft}</td>
                          <td style={{ padding:"12px 14px", color:"#ccc", textAlign:"center" }}>{f.ulds}</td>
                          <td style={{ padding:"12px 14px", color:"#ccc", fontFamily:"monospace" }}>{f.weight}</td>
                          <td style={{ padding:"12px 14px", minWidth:100 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                              <div style={{ flex:1 }}><UtilBar pct={f.util} color={f.util >= 90 ? "#22c55e" : f.util >= 70 ? "#EAB308" : "#f97316"} /></div>
                              <span style={{ fontSize:11, color:"#aaa", minWidth:26 }}>{f.util}%</span>
                            </div>
                          </td>
                          <td style={{ padding:"12px 14px" }}>
                            <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:99, background:m.bg, color:m.text, whiteSpace:"nowrap" }}>
                              <span style={{ display:"inline-block", width:6, height:6, borderRadius:99, background:m.dot, marginRight:5, verticalAlign:"middle" }} />
                              {m.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Alerts panel */}
            <div style={{ background:"#1a1a1a", borderRadius:16, border:"0.5px solid rgba(255,255,255,.08)", overflow:"hidden" }}>
              <div style={{ padding:"16px 18px", borderBottom:"0.5px solid rgba(255,255,255,.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:14, fontWeight:600, color:"#ddd" }}>
                  <i className="ti ti-bell" style={{ marginRight:7, color:"#EAB308" }} aria-hidden="true" />
                  Live alerts
                </span>
                <span style={{ fontSize:11, background:"rgba(239,68,68,.15)", color:"#ef4444", padding:"2px 8px", borderRadius:99, fontWeight:600 }}>
                  {criticalCount} critical
                </span>
              </div>
              <div style={{ padding:"8px 0" }}>
                {ALERTS.map(a => {
                  const m = ALERT_META[a.level];
                  return (
                    <div key={a.id} style={{ padding:"10px 16px", display:"flex", gap:10, alignItems:"flex-start", borderBottom:"0.5px solid rgba(255,255,255,.04)" }}>
                      <div style={{ background:m.bg, borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                        <i className={`ti ${m.icon}`} style={{ fontSize:16, color:m.color }} aria-hidden="true" />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"#EAB308", marginBottom:2 }}>{a.flight}</div>
                        <div style={{ fontSize:12, color:"#bbb", lineHeight:1.4, marginBottom:3 }}>{a.title}</div>
                        <div style={{ fontSize:10, color:"#555" }}>{a.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding:"12px 16px", borderTop:"0.5px solid rgba(255,255,255,.07)" }}>
                <button style={{ width:"100%", background:"rgba(234,179,8,.1)", border:"0.5px solid rgba(234,179,8,.25)", color:"#EAB308", borderRadius:9, padding:"8px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  View all alerts
                </button>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

            {/* ULD utilization */}
            <div style={{ background:"#1a1a1a", borderRadius:16, border:"0.5px solid rgba(255,255,255,.08)", padding:"18px 20px" }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#ddd", marginBottom:16 }}>
                <i className="ti ti-box" style={{ marginRight:8, color:"#EAB308" }} aria-hidden="true" />
                ULD utilization — today
              </div>
              {ULD_UTIL.map(u => (
                <div key={u.type} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:12, color:"#ccc", fontWeight:600 }}>{u.type}</span>
                    <span style={{ fontSize:12, color:"#888" }}>{u.loaded}/{u.total} &nbsp;·&nbsp; <span style={{ color: u.pct >= 85 ? "#22c55e" : "#EAB308" }}>{u.pct}%</span></span>
                  </div>
                  <UtilBar pct={u.pct} color={u.pct >= 85 ? "#22c55e" : "#EAB308"} />
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ background:"#1a1a1a", borderRadius:16, border:"0.5px solid rgba(255,255,255,.08)", padding:"18px 20px" }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#ddd", marginBottom:14 }}>
                <i className="ti ti-bolt" style={{ marginRight:8, color:"#EAB308" }} aria-hidden="true" />
                Quick actions
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { icon:"ti-plus", label:"New load plan",    color:"#EAB308" },
                  { icon:"ti-box",  label:"Build ULD",        color:"#60a5fa" },
                  { icon:"ti-3d-cube-sphere", label:"3D viewer", color:"#a78bfa" },
                  { icon:"ti-file-report", label:"Run report",  color:"#22c55e" },
                  { icon:"ti-alert-hexagon", label:"DG check", color:"#f97316" },
                  { icon:"ti-plane-departure", label:"New flight", color:"#EAB308" },
                ].map(a => (
                  <button key={a.label} style={{
                    background:"rgba(255,255,255,.04)", border:"0.5px solid rgba(255,255,255,.08)",
                    borderRadius:10, padding:"12px 10px", cursor:"pointer", textAlign:"left",
                    display:"flex", alignItems:"center", gap:9, transition:"background .12s",
                    color:"#bbb",
                  }}>
                    <span style={{ background:`${a.color}18`, borderRadius:7, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <i className={`ti ${a.icon}`} style={{ fontSize:15, color:a.color }} aria-hidden="true" />
                    </span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}