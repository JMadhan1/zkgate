import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/icons";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-bricolage", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BlindPay", template: "%s · BlindPay" },
  description: "Approve your team's spend on WhatsApp, pay by UPI, keep the GST.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BlindPay", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f13" },
    { media: "(prefers-color-scheme: light)", color: "#f4f0e7" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`no-js ${bricolage.variable} ${jetbrains.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script src="/theme-init.js" nonce={nonce} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <header className="nav-wrap" data-scrolled="true">
          <div className="container">
            <nav className="nav" aria-label="Main">
              <a href="/" className="brand"><BrandMark className="brand-mark" /> blindpay</a>
              <div className="nav-actions" style={{ marginLeft: "auto" }}>
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
