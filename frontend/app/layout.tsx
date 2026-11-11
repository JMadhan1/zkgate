import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import NextLink from "next/link";
import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { REPO_URL, SITE_URL } from "@/lib/site";
import { Effects } from "@/components/Effects";
import { BrandMark } from "@/components/icons";
import "./globals.css";

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
    { media: "(prefers-color-scheme: dark)", color: "#07080d" },
    { media: "(prefers-color-scheme: light)", color: "#fbf9f4" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce from proxy.ts (also makes rendering dynamic, which
  // nonces require).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`no-js ${GeistSans.variable} ${GeistMono.variable} ${instrument.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the theme before first paint; external file, no inline script. */}
        <script src="/theme-init.js" nonce={nonce} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <div className="aurora" aria-hidden><span /></div>
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
            <NextLink href="/" className="brand"><BrandMark className="brand-mark" /> ZKGate <small>India</small></NextLink>
            <p>Your Aadhaar XML never leaves your device. Only a mathematical proof is shared.</p>
            <div className="tricolor-line" style={{ marginTop: 20 }} />
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li><NextLink href="/prove">Citizen demo</NextLink></li>
              <li><a href="/#how">How it works</a></li>
              <li><a href="/#claims">Claim types</a></li>
              <li><a href="/#compare">Comparison</a></li>
            </ul>
          </div>
          <div>
            <h5>Docs</h5>
            <ul>
              <li><a href={`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noreferrer">Architecture</a></li>
              <li><a href={`${REPO_URL}/blob/main/docs/CLAIMS.md`} target="_blank" rel="noreferrer">Claims</a></li>
              <li><a href={`${REPO_URL}/blob/main/docs/API.md`} target="_blank" rel="noreferrer">Verifier API</a></li>
              <li><a href={`${REPO_URL}/blob/main/docs/UIDAI_INTEGRATION.md`} target="_blank" rel="noreferrer">UIDAI integration</a></li>
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
        <div className="footer-bottom">
          <span>© 2026 ZKGate India · MIT licence · Research prototype</span>
          <span>Built for Sovereign Technology for India 🇮🇳</span>
        </div>
      </div>
    </footer>
  );
}
