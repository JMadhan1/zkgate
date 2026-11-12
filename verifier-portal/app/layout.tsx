import type { Metadata } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/icons";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-bricolage", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: "ZKGate India · Verifier Portal",
  description: "Request and verify zero-knowledge identity proofs from citizens, without collecting their data.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce from proxy.ts (and per-request rendering, which nonces need).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`no-js ${bricolage.variable} ${jetbrains.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script src="/theme-init.js" nonce={nonce} />
      </head>
      <body>
        <header className="nav-wrap" data-scrolled="true">
          <div className="container">
            <nav className="nav" aria-label="Main">
              <span className="brand"><BrandMark className="brand-mark" /> zkgate<sup>VERIFIER</sup></span>
              <div className="nav-actions" style={{ marginLeft: "auto" }}>
                <span className="kicker hide-sm" style={{ marginRight: 8 }}>for banks &amp; institutions</span>
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="footer" style={{ marginTop: 30, paddingTop: 30 }}>
          <div className="container footer-bottom" style={{ marginTop: 0 }}>
            <span>You receive only the claim. No personal data is ever transmitted to you.</span>
            <span>© 2026 ZKGate India</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
