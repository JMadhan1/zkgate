import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Web3Providers } from "@/app/components/Web3Providers";
import { MeshBackground } from "@/app/components/MeshBackground";
import { Navbar } from "@/app/components/Navbar";
import { AIExplainer } from "@/app/components/AIExplainer";


const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: "ZKGate | Privacy-Preserving Identity on HashKey Chain",
  description: "The first privacy-preserving compliance layer for HashKey Chain. Zero-Knowledge proof technology meets regulatory standards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased font-inter`} style={{ background: '#050510' }}>
        <Web3Providers>
          {/* Gradient Orbs */}
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />

          {/* Dot Grid Overlay */}
          <div className="bg-grid" />

          {/* Particle Mesh */}
          <MeshBackground />


          {/* Navigation */}
          <Navbar />

          {/* Page Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>

          {/* AI Assistant — floats on all pages */}
          <AIExplainer />
        </Web3Providers>
      </body>
    </html>
  );
}
