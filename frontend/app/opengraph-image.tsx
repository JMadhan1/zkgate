import { ImageResponse } from "next/og";

export const alt = "ZKGate India — Prove a fact, not your identity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 72, background: "#07080d", color: "#eef0f6", fontFamily: "sans-serif",
          backgroundImage:
            "radial-gradient(circle at 0% 0%, rgba(255,153,51,0.35), transparent 45%), radial-gradient(circle at 100% 100%, rgba(19,136,8,0.4), transparent 45%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#FF9933,#2fd36b)" }} />
          ZKGate India
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>Prove a fact.</div>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1, color: "#ffab57" }}>Not your identity.</div>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#9a9fb2" }}>
          <span>Groth16 zero-knowledge proofs</span><span>·</span><span>Aadhaar offline eKYC</span><span>·</span><span>On-device</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, display: "flex" }}>
          <div style={{ flex: 1, background: "#FF9933" }} /><div style={{ flex: 1, background: "#ffffff" }} /><div style={{ flex: 1, background: "#138808" }} />
        </div>
      </div>
    ),
    size,
  );
}
