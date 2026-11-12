"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "./icons";

type Step = {
  short: string;
  title: string;
  where: "device" | "server";
  body: ReactNode;
  checks?: { b: string; t: string }[];
  term: ReactNode;
};

const STEPS: Step[] = [
  {
    short: "Get eKYC XML",
    title: "Download your offline eKYC",
    where: "device",
    body: <>You download your own UIDAI offline eKYC XML. It&apos;s OTP-gated and digit-masked, with a fresh reference ID every time. It never touches any server in this system.</>,
    term: (<><span className="c"># stays on the citizen&apos;s device</span>{"\n"}<span className="k">&lt;OfflinePaperlessKyc</span> referenceId=<span className="s">&quot;xxxx1234…&quot;</span><span className="k">&gt;</span></>),
  },
  {
    short: "Parse locally",
    title: "Parse it in the browser",
    where: "device",
    body: <><code>sdk/src/aadhaar.js</code> reads the date of birth, state, PIN and signature block client-side. There is no upload endpoint. Open your network tab and you&apos;ll see nothing leave.</>,
    term: (<><span className="o">const</span> parsed = parseAadhaarXml(xml){"\n"}<span className="c">// {"{"} dob_year, state_code, pincode … {"}"}, never sent</span></>),
  },
  {
    short: "Build witness",
    title: "Derive a secret, build the witness",
    where: "device",
    body: <>A Poseidon hash derives your private <code>aadhaar_secret</code>. The SDK assembles the private witness (DOB, state, secret and an issuer-signed credential) for exactly the claim you&apos;re proving.</>,
    term: (<><span className="o">const</span> secret = <span className="k">await</span> deriveSecret(referenceId){"\n"}<span className="o">const</span> witness = buildWitness({"{"} claimType, fields, secret {"}"})</>),
  },
  {
    short: "Prove",
    title: "Generate the proof on-device",
    where: "device",
    body: <>snarkjs runs the Circom circuit locally and outputs a ~800-byte Groth16 proof. The circuit <em>constrains</em> the claim, so a 17-year-old can&apos;t produce an &ldquo;18+&rdquo; proof at all.</>,
    term: (<><span className="o">const</span> {"{"} proof, publicSignals {"}"} ={"\n"}  <span className="k">await</span> groth16.fullProve(witness, <span className="s">&quot;age_proof.wasm&quot;</span>, <span className="s">&quot;age_proof.zkey&quot;</span>)</>),
  },
  {
    short: "Send proof",
    title: "Send only the proof",
    where: "device",
    body: <>The proof and its public signals go to the verifier&apos;s <code>POST /v1/verify</code>. The XML, the DOB and the Aadhaar number are never sent.</>,
    term: (<><span className="k">POST</span> /v1/verify{"\n"}{"{"} <span className="s">&quot;proof_bundle&quot;</span>: {"{"} proof, public_signals {"}"} {"}"}</>),
  },
  {
    short: "4 checks",
    title: "Four gates on the server",
    where: "server",
    body: <>The verifier says yes only if all four pass:</>,
    checks: [
      { b: "Pairing check.", t: "An independent Python Groth16 verifier, cross-checked against snarkjs." },
      { b: "Semantic gate.", t: "The proof must answer the question asked, so 18+ can't satisfy 21+." },
      { b: "Nullifier.", t: "Poseidon(secret, verifier, expiry): replays are refused, and verifiers can't link citizens." },
      { b: "Audit chain.", t: "Every verdict goes into a hash-chained, tamper-evident log." },
    ],
    term: (<><span className="c"># pairing ✓  semantic ✓  nullifier ✓  audit ✓</span></>),
  },
  {
    short: "Verdict",
    title: "A verdict, and nothing else",
    where: "server",
    body: <>The verifier learns that the claim holds. No name, DOB, address or Aadhaar number was transmitted or stored, so a breach of the verifier leaks nothing about you.</>,
    term: (<>{"{"} <span className="s">&quot;valid&quot;</span>: <span className="o">true</span>, <span className="s">&quot;claims&quot;</span>: {"{"} <span className="s">&quot;age_above_18&quot;</span>: <span className="o">true</span> {"}"} {"}"}</>),
  },
];

export function Story() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.idx));
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const s = STEPS[active];
  const pct = ((active + 1) / STEPS.length) * 100;

  return (
    <div className="story">
      <div className="story-sticky">
        <div className="story-panel" aria-hidden>
          <div className="story-big">
            {String(active + 1).padStart(2, "0")}
            <small>/ {String(STEPS.length).padStart(2, "0")}</small>
          </div>
          <div className="lanes">
            {(["device", "server"] as const).map((lane) => (
              <div className="lane" key={lane} data-active={s.where === lane}>
                <h5>{lane === "device" ? "Citizen's device" : "Verifier's server"}</h5>
                <ol>
                  {STEPS.map((st, i) =>
                    st.where === lane ? (
                      <li key={st.short} data-active={i === active} data-done={i < active}>
                        <i>{String(i + 1).padStart(2, "0")}</i>
                        {st.short}
                      </li>
                    ) : null,
                  )}
                </ol>
              </div>
            ))}
          </div>
          <div className="wire"><i style={{ width: `${pct}%` }} /></div>
          <div className="story-term" key={active}>{s.term}</div>
        </div>
      </div>

      <div className="steps-col">
        {STEPS.map((st, i) => (
          <article
            key={st.title}
            className="st"
            data-idx={i}
            data-active={i === active}
            ref={(el) => { refs.current[i] = el; }}
          >
            <div className="where">
              <span>Step {String(i + 1).padStart(2, "0")}</span>
              <b className={st.where === "device" ? "dev" : "srv"}>
                {st.where === "device" ? "on your device" : "on the verifier's server"}
              </b>
            </div>
            <h3>{st.title}</h3>
            <p>{st.body}</p>
            {st.checks && (
              <div className="checks">
                {st.checks.map((c) => (
                  <div className="check" key={c.b}><Check /><div><b>{c.b}</b> {c.t}</div></div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
