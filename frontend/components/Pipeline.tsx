"use client";

import { useState, type ReactNode } from "react";
import { Arrow, Check } from "./icons";

type Step = {
  title: string;
  where: "device" | "server";
  body: ReactNode;
  checks?: { b: string; t: string }[];
  term?: ReactNode;
};

const STEPS: Step[] = [
  {
    title: "Get the offline eKYC XML",
    where: "device",
    body: (
      <>The citizen downloads their own UIDAI offline eKYC XML. It's OTP-gated, digit-masked, and carries a fresh rotating reference ID each time. It never touches any server in this system.</>
    ),
    term: (<><span className="c"># downloaded from UIDAI, kept locally</span>{"\n"}<span className="k">&lt;OfflinePaperlessKyc</span> referenceId=<span className="s">&quot;xxxx1234…&quot;</span><span className="k">&gt;</span></>),
  },
  {
    title: "Parse entirely in the browser",
    where: "device",
    body: (
      <><code className="code-chip">sdk/src/aadhaar.js</code> parses the XML client-side: DOB, state, pincode and the signature block. The data stays in memory on the citizen&apos;s device only. There is no upload endpoint at all.</>
    ),
    term: (<><span className="o">const</span> parsed = parseAadhaarXml(xml){"\n"}<span className="c">// → {"{"} dob_year, state_code, pincode, … {"}"}  (never sent)</span></>),
  },
  {
    title: "Derive a secret & build the witness",
    where: "device",
    body: (
      <>A Poseidon hash derives a private <code className="code-chip">aadhaar_secret</code>. The SDK assembles the private witness (DOB, state, secret, issuer-signed credential) for exactly the claim being proven.</>
    ),
    term: (<><span className="o">const</span> secret = <span className="k">await</span> deriveSecret(referenceId){"\n"}<span className="o">const</span> witness = buildWitness({"{"} claimType, fields, secret {"}"})</>),
  },
  {
    title: "Generate the proof, on-device",
    where: "device",
    body: (
      <><code className="code-chip">snarkjs.groth16.fullProve</code> runs the Circom circuit locally, with the wasm and proving key fetched as public static assets. It outputs a ~800-byte Groth16 proof plus its public signals.</>
    ),
    term: (<><span className="o">const</span> {"{"} proof, publicSignals {"}"} ={"\n"}  <span className="k">await</span> groth16.fullProve(witness, <span className="s">&quot;age_proof.wasm&quot;</span>, <span className="s">&quot;age_proof.zkey&quot;</span>)</>),
  },
  {
    title: "Send only the proof",
    where: "device",
    body: (
      <>The proof and public signals go to the verifier&apos;s <code className="code-chip">POST /v1/verify</code> endpoint. The XML, the DOB and the Aadhaar number are never sent.</>
    ),
    term: (<><span className="k">POST</span> /v1/verify{"\n"}{"{"} <span className="s">&quot;proof_bundle&quot;</span>: {"{"} proof, public_signals {"}"}, <span className="s">&quot;verifier_id&quot;</span>: <span className="s">&quot;99999&quot;</span> {"}"}</>),
  },
  {
    title: "Four checks on the backend",
    where: "server",
    body: <>The FastAPI verifier runs four independent gates before saying yes.</>,
    checks: [
      { b: "Pairing check.", t: "An independent Python Groth16 verifier, cross-checked against snarkjs, rejects tampered proofs and off-curve points." },
      { b: "Semantic gate.", t: "Do the public signals answer what the verifier asked? An age ≥ 18 proof can't satisfy an age ≥ 21 request." },
      { b: "Nullifier registry.", t: "Poseidon(secret, verifier_id, expiry) catches replay: first use wins, per (claim_type, nullifier)." },
      { b: "Audit chain.", t: "Every verification is written to a hash-chained log, so tampering with history is detectable." },
    ],
  },
  {
    title: "Verifier gets a verdict, nothing else",
    where: "server",
    body: <>The response contains a verdict and nothing more. No name, DOB, address or Aadhaar number was ever transmitted or stored.</>,
    term: (<>{"{"}{"\n"}  <span className="s">&quot;valid&quot;</span>: <span className="o">true</span>,{"\n"}  <span className="s">&quot;claims&quot;</span>: {"{"} <span className="s">&quot;age_above_18&quot;</span>: <span className="o">true</span> {"}"},{"\n"}  <span className="s">&quot;nullifier&quot;</span>: <span className="s">&quot;0x1f…&quot;</span>,{"\n"}  <span className="s">&quot;trust_level&quot;</span>: <span className="s">&quot;attested&quot;</span>{"\n"}{"}"}</>),
  },
];

export function Pipeline() {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  return (
    <div className="pipeline">
      <ul className="pipe-list" role="tablist" aria-label="Proof pipeline steps">
        {STEPS.map((st, idx) => (
          <li key={st.title}>
            <button
              role="tab"
              id={`pipe-tab-${idx}`}
              aria-selected={i === idx}
              aria-controls="pipe-panel"
              className="pipe-btn"
              onClick={() => setI(idx)}
            >
              <span className="pipe-num">{String(idx + 1).padStart(2, "0")}</span>
              <span>{st.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="card pipe-panel" role="tabpanel" id="pipe-panel" aria-labelledby={`pipe-tab-${i}`}>
        <div key={i} className="fade-in">
          <div className="where">
            Step {i + 1} of {STEPS.length} · runs on{" "}
            {s.where === "device" ? <b>the citizen&apos;s device</b> : <b className="server">the verifier&apos;s server</b>}
          </div>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
          {s.checks && (
            <div className="pipe-checks">
              {s.checks.map((c) => (
                <div className="pipe-check" key={c.b}>
                  <Check />
                  <div><b>{c.b}</b> {c.t}</div>
                </div>
              ))}
            </div>
          )}
          {s.term && <div className="terminal">{s.term}</div>}
        </div>
        <div className="pipe-nav">
          <button className="btn btn-sm" onClick={() => setI((i + STEPS.length - 1) % STEPS.length)} aria-label="Previous step">
            ←
          </button>
          <button className="btn btn-sm" onClick={() => setI((i + 1) % STEPS.length)}>
            {i === STEPS.length - 1 ? "Start over" : "Next step"} <Arrow className="arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}
