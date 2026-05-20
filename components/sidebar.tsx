"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { label: "Dashboard", href: "/", badge: null },
  { label: "Flights", href: "/flights", badge: 6 },
  { label: "Shipments", href: "/shipments", badge: 142 },
  { label: "ULD Builder", href: "/uld", badge: null },
  { label: "3D View", href: "/3dview", badge: null },
  { label: "Load Planning", href: "/planning", badge: null },
  { label: "DG Compliance", href: "/dg", badge: 2 },
  { label: "Reports", href: "/reports", badge: null },
  { label: "Settings", href: "/settings", badge: null },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: "#141414",
      borderRight: "0.5px solid rgba(255,255,255,.07)",
      display: "flex",
      flexDirection: "column",
      transition: "width .2s",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "0.5px solid rgba(255,255,255,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#EAB308", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#000", fontWeight: 900, fontSize: 14 }}>A</span>
          </div>
          <div>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>AdeyIQ</p>
            <p style={{ color: "#666", fontSize: 11, margin: 0 }}>Cargo Operations</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ padding: "12px 8px", flex: 1 }}>
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link key={item.label} href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 12px",
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: "none",
                background: isActive ? "#EAB308" : "transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <span style={{ color: isActive ? "#000" : "#ccc", fontSize: 13, fontWeight: isActive ? 700 : 400 }}>
                {item.label}
              </span>
              {item.badge && (
                <span style={{
                  background: isActive ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.1)",
                  color: isActive ? "#000" : "#999",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 7px",
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