"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Package,
  Plane,
  Settings,
  View,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/", badge: null, icon: LayoutDashboard },
  { label: "Flights", href: "/flights", badge: 6, icon: Plane },
  { label: "Shipments", href: "/shipments", badge: 142, icon: Package },
  { label: "3D View", href: "/3dview", badge: null, icon: View },
  { label: "Load Planning", href: "/planning", badge: null, icon: ClipboardList },
  { label: "Optimizer", href: "/optimizer", badge: null, icon: Boxes },
  { label: "DG Compliance", href: "/dg", badge: 2, icon: AlertTriangle },
  { label: "Reports", href: "/reports", badge: null, icon: BarChart3 },
  { label: "Settings", href: "/settings", badge: null, icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? 68 : 220,
      flexShrink: 0,
      background: "#141414",
      borderRight: "0.5px solid rgba(255,255,255,.07)",
      display: "flex",
      flexDirection: "column",
      transition: "width .2s",
      overflow: "visible",
      position: "relative",
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? "18px 12px 14px" : "20px 16px 16px", borderBottom: "0.5px solid rgba(255,255,255,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#EAB308", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#000", fontWeight: 900, fontSize: 14 }}>A</span>
          </div>
          {!collapsed && <div>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>AdeyIQ</p>
            <p style={{ color: "#666", fontSize: 11, margin: 0 }}>Cargo Operations</p>
          </div>}
        </div>
      </div>

      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => setCollapsed((value) => !value)}
        style={{
          position: "absolute",
          top: 20,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: 999,
          border: "0.5px solid rgba(255,255,255,.12)",
          background: "#1f1f1f",
          color: "#EAB308",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 5,
        }}
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {/* Nav Items */}
      <nav style={{ padding: collapsed ? "12px 8px" : "12px 8px", flex: 1 }}>
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link key={item.label} href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: "space-between",
                padding: collapsed ? "10px 0" : "9px 12px",
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: "none",
                background: isActive ? "#EAB308" : "transparent",
                transition: "background 0.15s",
                minHeight: 38,
                position: "relative",
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <span style={{
                color: isActive ? "#000" : "#ccc",
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: 10,
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
              }}>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>}
              </span>
              {item.badge && (
                <span style={{
                  position: collapsed ? "absolute" : "static",
                  right: collapsed ? 7 : undefined,
                  transform: collapsed ? "translateY(-9px)" : undefined,
                  background: isActive ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.1)",
                  color: isActive ? "#000" : "#999",
                  fontSize: collapsed ? 9 : 11,
                  fontWeight: 600,
                  padding: collapsed ? "0 4px" : "1px 7px",
                  borderRadius: 20,
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
