"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "./icons";

type Mode = "kyc" | "zk";

const FIELDS = [
  { k: "Full name", v: "Madhan Kumar" },
  { k: "Date of birth", v: "10 / 07 / 1998" },
  { k: "Address", v: "12/4 MG Road, Ganesh Nagar, Chittoor" },
  { k: "PIN code", v: "517001" },
  { k: "ID number", v: "XXXX XXXX 3632" },
];
const LEAKS = ["Name", "Photo", "Date of birth", "Exact age", "Address", "PIN code", "ID number"];

/** "What does the verifier actually receive?" — photocopy KYC vs. ZKGate. */
export function IdCompare() {
  const [mode, setMode] = useState<Mode>("kyc");
  const touched = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  // Flip to ZK once when it scrolls into view, so the point lands unprompted,
  // unless the user has already chosen a side.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      timer = window.setTimeout(() => { if (!touched.current) setMode("zk"); }, 1400);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, []);

  const pick = (m: Mode) => { touched.current = true; setMode(m); };
  const count = mode === "kyc" ? LEAKS.length : 0;

  return (
    <div className="compare" ref={ref}>
      <div>
        <div className="seg" role="group" aria-label="Compare what a verifier receives">
          <button aria-pressed={mode === "kyc"} onClick={() => pick("kyc")}>Today: photocopy KYC</button>
          <button aria-pressed={mode === "zk"} onClick={() => pick("zk")}>With ZKGate</button>
        </div>
        <div className="idcard" data-mode={mode} aria-label={mode === "kyc" ? "Identity document, fully visible" : "Identity document, fully redacted, stamped age 18 or older verified"}>
          <div className="idcard-top">
            <b>Identity document</b>
            <span>{mode === "kyc" ? "COPY SHARED WITH VERIFIER" : "NOTHING SHARED"}</span>
          </div>
          <div className="idcard-body">
            <div className="photo"><User /></div>
            <div className="idf">
              {FIELDS.map((f, i) => (
                <div className="idf-row" key={f.k} style={{ ["--i" as string]: i }}>
                  <small>{f.k}</small>
                  <b>{f.v}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="stamp" aria-hidden>
            <small>VERIFIED BY PROOF</small>
            <b>AGE ≥ 18 ✓</b>
          </div>
        </div>
      </div>

      <div className="disclosed">
        <span className="kicker">Fields the verifier receives</span>
        <div className="count" data-mode={mode} aria-live="polite">
          <span>{count}</span>
        </div>
        <p>
          {mode === "kyc"
            ? "To prove one fact, today you hand over a copy of everything. Each copy is another database that can leak."
            : "The verifier gets a yes/no answer it can check mathematically, plus an anonymous nullifier that blocks replays. There's nothing left to leak."}
        </p>
        <div className="leaklist">
          {LEAKS.map((l) => (
            <span key={l} className="leak" data-on={mode === "kyc"}>{l}</span>
          ))}
          {mode === "zk" && <span className="leak ok">age ≥ 18: true</span>}
        </div>
      </div>
    </div>
  );
}
