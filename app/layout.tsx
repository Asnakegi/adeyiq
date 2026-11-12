import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* These App Router pages are an early dashboard prototype with invented sample data. They stay reachable
   for demos but are labelled as such and kept out of search engines; the product lives at / and /build. */
export const metadata: Metadata = {
  title: "AdeyIQ - Dashboard prototype (demo data)",
  description: "Early AdeyIQ dashboard prototype with sample data. Not connected to live operations.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "#111111", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flex: 1, minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: "auto", background: "#111111" }}>
            <div role="note" style={{ background: "#FFD21F", color: "#0A2540", padding: "8px 16px", fontSize: 14, fontWeight: 600 }}>
              Demo prototype: all flights, shipments and alerts on these pages are invented sample data, not live operations.{" "}
              <a href="/build" style={{ color: "#0A2540", textDecoration: "underline" }}>Open the Cargo Builder</a>
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}