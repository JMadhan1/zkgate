"use client";

import { useEffect, useState } from "react";
import { Check, Lock } from "./icons";

// A looping, illustrative animation of the pipeline: private fields go in,
// are consumed by the circuit, and only a proof + a boolean verdict come out.
// The data is the repo's synthetic test citizen — not a real person.

const FIELDS = [
  { k: "name", v: "Madhan Kumar" },
  { k: "dob", v: "10-07-1998" },
  { k: "address", v: "12/4 MG Road, Chittoor" },
  { k: "pincode", v: "517001" },
  { k: "aadhaar", v: "xxxx-xxxx-3632" },
  { k: "state", v: "Andhra Pradesh" },
];

const CLAIMS = [
  { id: "age_above_18", verdict: "age_above_18: true", keep: [] as string[] },
  { id: "state_resident", verdict: "state: Andhra Pradesh", keep: ["state"] },
  { id: "india_citizen", verdict: "india_citizen: true", keep: [] as string[] },
];

// Decorative only, but use the CSPRNG anyway: no Math.random in this codebase.
function randHex(n: number) {
  if (n <= 0) return "";
  const bytes = new Uint8Array(Math.ceil(n / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, n);
}

type Phase = "idle" | "hiding" | "proving" | "done";

export function HeroVisual() {
  const [ci, setCi] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hidden, setHidden] = useState(0);
  const [pct, setPct] = useState(0);
  const [proof, setProof] = useState({ a: "", b: "", c: "" });

  const claim = CLAIMS[ci];

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setHidden(FIELDS.length);
      setPct(100);
      setProof({ a: randHex(40), b: randHex(40), c: randHex(40) });
      setPhase("done");
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));

    (async function loop() {
      let i = 0;
      while (!cancelled) {
        setCi(i);
        setPhase("idle"); setHidden(0); setPct(0); setProof({ a: "", b: "", c: "" });
        await wait(1100);
        setPhase("hiding");
        for (let h = 1; h <= FIELDS.length && !cancelled; h++) { setHidden(h); await wait(170); }
        setPhase("proving");
        for (let p = 0; p <= 100 && !cancelled; p += 4) {
          setPct(p);
          const n = Math.floor((p / 100) * 40);
          setProof({ a: randHex(Math.min(n, 40)), b: randHex(Math.max(0, n - 10)), c: randHex(Math.max(0, n - 20)) });
          await wait(38);
        }
        setProof({ a: randHex(40), b: randHex(40), c: randHex(40) });
        setPhase("done");
        await wait(3200);
        i = (i + 1) % CLAIMS.length;
      }
    })();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  return (
    <div className="proof-visual" role="img" aria-label="Animation: private Aadhaar fields are hidden, a zero-knowledge proof is generated, and the verifier receives only a true/false answer.">
      <div className="proof-visual-inner">
        <div className="pv-bar">
          <i /><i /><i />
          <span>citizen-device · prove({claim.id})</span>
          <span className="live">on-device</span>
        </div>
        <div className="pv-body">
          <div className="pv-label"><span>Private input · offline eKYC XML</span><span>{hidden}/{FIELDS.length} sealed</span></div>
          <div className="pv-fields">
            {FIELDS.map((f, i) => {
              const sealed = i < hidden && !claim.keep.includes(f.k);
              return (
                <div className="pv-field" key={f.k} data-hidden={sealed}>
                  <small>{f.k}</small>
                  <b>{f.v}</b>
                </div>
              );
            })}
          </div>
          <div className="pv-arrow">
            <span className="chip"><Lock width={13} height={13} /> Groth16 · BN128</span>
          </div>
          <div className="pv-progress"><i style={{ width: `${pct}%` }} /></div>
          <div className="pv-proof" aria-hidden>
            <span className="k">π.a</span> {proof.a || "…"}<br />
            <span className="k">π.b</span> {proof.b || "…"}<br />
            <span className="k">π.c</span> {proof.c || "…"}
          </div>
          <div className="pv-result">
            <span className="verdict" data-show={phase === "done"}>
              <Check width={15} height={15} /> {claim.verdict}
            </span>
            <span className="pv-size">~800 bytes · 0 personal fields</span>
          </div>
        </div>
      </div>
    </div>
  );
}
