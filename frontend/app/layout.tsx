import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import NextLink from "next/link";
import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { REPO_URL, SITE_URL } from "@/lib/site";
import { Effects } from "@/components/Effects";
import { BrandMark } from "@/components/icons";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ZKGate India — Prove a fact, not your identity",
    template: "%s · ZKGate India",
  },
  description:
    "India's indigenous zero-knowledge identity layer. Prove you're an adult, a resident, or a valid Aadhaar holder without revealing your DOB, address, photo or Aadhaar number.",
  keywords: ["zero-knowledge", "Aadhaar", "ZK proof", "Groth16", "Circom", "DPDP", "age verification", "India", "privacy", "eKYC"],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ZKGate India",
    title: "ZKGate India — Prove a fact, not your identity",
    description: "A ~800-byte zero-knowledge proof that answers one question, and reveals nothing else.",
  },
  twitter: { card: "summary_large_image", creator: "@jmadhanai" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f13" },
    { media: "(prefers-color-scheme: light)", color: "#f4f0e7" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce from proxy.ts (also makes rendering dynamic, which
  // nonces require).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`no-js ${bricolage.variable} ${jetbrains.variable} ${instrument.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the theme before first paint; external file, no inline script. */}
        <script src="/theme-init.js" nonce={nonce} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <Effects />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <NextLink href="/" className="brand"><BrandMark className="brand-mark" /> zkgate<sup>IN</sup></NextLink>
            <p>Your Aadhaar XML never leaves your device. Only a mathematical proof is shared.</p>
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li><NextLink href="/prove">Citizen demo</NextLink></li>
              <li><a href="/#how">How it works</a></li>
              <li><a href="/#claims">Claims</a></li>
              <li><a href="/#compare">Landscape</a></li>
            </ul>
          </div>
          <div>
            <h5>Docs</h5>
            <ul>
              <li><a href={`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noreferrer">Architecture</a></li>
              <li><a href={`${REPO_URL}/blob/main/docs/API.md`} target="_blank" rel="noreferrer">Verifier API</a></li>
              <li><a href={`${REPO_URL}/blob/main/docs/UIDAI_INTEGRATION.md`} target="_blank" rel="noreferrer">UIDAI integration</a></li>
              <li><a href={`${REPO_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">Security</a></li>
            </ul>
          </div>
          <div>
            <h5>Project</h5>
            <ul>
              <li><a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a></li>
              <li><a href="https://x.com/jmadhanai" target="_blank" rel="noreferrer">X / Twitter</a></li>
              <li><a href="https://www.linkedin.com/in/jmadhan/" target="_blank" rel="noreferrer">LinkedIn</a></li>
            </ul>
          </div>
        </div>
        <div className="wordmark" aria-hidden>zkgate<span>.</span></div>
        <div className="footer-bottom">
          <span>© 2026 ZKGate India · MIT · research prototype</span>
          <span>Made for India 🇮🇳</span>
        </div>
      </div>
    </footer>
  );
}
