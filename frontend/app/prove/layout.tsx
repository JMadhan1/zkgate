import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Citizen demo — generate a zero-knowledge proof",
  description:
    "Parse an Aadhaar offline eKYC XML in your browser, pick a claim, and generate a Groth16 proof on-device. Nothing is uploaded.",
  alternates: { canonical: "/prove" },
};

export default function ProveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
