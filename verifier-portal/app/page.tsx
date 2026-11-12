"use client";

import { useState } from "react";
import { Arrow, Check, Info, Lock, Shield, X } from "@/components/icons";

// In production the API must be configured explicitly (and be https, which
// proxy.ts adds to the CSP); localhost is only a development default.
const API =
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");
const DEMO_VERIFIER = "99999";

// The set of asks a verifier can make. Mirrors the API's claim catalogue; a real
// portal would fetch /v1/claims, but hardcoding keeps the demo offline-friendly.
const ASKS = [
  { id: "age_above_18", label: "Age 18 or older", expected: { age_threshold: 18 } },
  { id: "age_above_21", label: "Age 21 or older", expected: { age_threshold: 21 } },
  { id: "india_citizen", label: "Holds a valid Aadhaar", expected: {} },
  { id: "state_resident", label: "Resident of Andhra Pradesh", expected: { required_state_code: 28 } },
  { id: "compound_kyc", label: "Full KYC (citizen + 18+ + AP)", expected: { age_threshold: 18, required_state_code: 28 } },
];

export default function VerifierHome() {
  const [askId, setAskId] = useState("age_above_18");
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = ASKS.find((a) => a.id === askId)!;

  async function onVerify() {
    setBusy(true);
    setError(null);
    setResult(null);
    if (!API) {
      setError("No verifier API is configured for this deployment (set NEXT_PUBLIC_API_URL).");
      setBusy(false);
      return;
    }
    if (pasted.length > 1_000_000) {
      setError("That's too large to be a proof bundle (max 1 MB).");
      setBusy(false);
      return;
    }
    try {
      const bundle = JSON.parse(pasted);
      // Accept either a raw proof bundle (from the citizen portal's download) or
      // a full verify request.
      const body = bundle.proof_bundle
        ? bundle
        : {
            proof_bundle: {
              proof: bundle.proof,
              public_signals: bundle.publicSignals || bundle.public_signals,
              // The verifier decides what it asked for; never let the pasted
              // bundle's own label choose the claim being checked.
              claim_type: ask.id,
              generated_at: bundle.generatedAt || bundle.generated_at || Math.floor(Date.now() / 1000),
              demo: bundle.demo ?? true,
            },
            verifier_id: DEMO_VERIFIER,
            expected: ask.expected,
          };
      const res = await fetch(`${API}/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message?.includes("JSON") ? "That doesn't look like a proof bundle (invalid JSON)." : `${e.message} (is the API running at ${API}?)`);
    } finally {
      setBusy(false);
    }
  }

  const requestPayload = {
    verifier_id: DEMO_VERIFIER,
    claim_type: ask.id,
    expected: ask.expected,
    expiry: Math.floor(Date.now() / 1000) + 300,
  };

  const errMsg = (r: any): string | null =>
    !r ? null : typeof r.error === "string" ? r.error : r.error?.message ?? null;

  return (
    <div className="app">
      <div className="container-wide">
        <header className="stage app-hero">
          <div>
            <span className="kicker"><span className="num">Verifier</span> Demo Bank · id 99999</span>
            <h1>Verify a citizen. <span className="serif" style={{ color: "var(--saffron)" }}>Collect nothing.</span></h1>
            <p className="lede">
              Ask for exactly the fact you need. The citizen&apos;s device returns a proof, and you learn{" "}
              <b>only whether the claim holds</b>. No Aadhaar number, DOB or address reaches your systems, so there&apos;s
              nothing to secure, breach or be liable for.
            </p>
          </div>
          <span className="privacy"><Lock /> Zero personal data received</span>
        </header>
      </div>

      <div className="container" style={{ maxWidth: 980 }}>
        <section className="panel" aria-labelledby="r1">
          <div className="panel-head">
            <div>
              <h2 id="r1">What do you need to know?</h2>
              <p>Pick the claim to request. Hand the request to the citizen (in production, as a QR code or a deep link).</p>
            </div>
            <span className="tag-step">01</span>
          </div>
          <div className="claim-grid" role="radiogroup" aria-label="Claim to request">
            {ASKS.map((a) => (
              <button key={a.id} role="radio" aria-checked={askId === a.id} className="claim-opt"
                onClick={() => { setAskId(a.id); setResult(null); setError(null); }}>
                <span className="radio" aria-hidden />
                <span className="t">{a.label}</span>
                <span className="m">{a.id}</span>
              </button>
            ))}
          </div>
          <div className="req">
            <div>
              <small>Proof request</small>
              <pre>{JSON.stringify(requestPayload, null, 2)}</pre>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="r2">
          <div className="panel-head">
            <div>
              <h2 id="r2">Verify the returned proof</h2>
              <p>Paste the proof bundle the citizen produced. The citizen portal&apos;s &ldquo;Download proof&rdquo; gives you exactly this.</p>
            </div>
            <span className="tag-step">02</span>
          </div>
          <textarea
            className="xml"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder='{ "proof": {...}, "publicSignals": [...], "claimType": "age_above_18" }'
            aria-label="Proof bundle JSON"
            spellCheck={false}
          />
          <div className="actions">
            <button className="btn btn-green" onClick={onVerify} disabled={busy || !pasted.trim()}>
              {busy ? <><span className="spinner" /> Verifying…</> : <><Shield /> Verify proof</>}
            </button>
          </div>
          {error && (
            <div className="callout error fade-in" role="alert">
              <X /><div><b>Couldn&apos;t verify</b><p>{error}</p></div><span />
            </div>
          )}
        </section>

        {result && (
          <section className="panel fade-in" aria-live="polite" aria-labelledby="r3">
            <h2 id="r3" className="sr-only">Result</h2>
            <div className={`verdict-banner ${result.valid ? "ok" : "bad"}`}>
              <span className="vb-ic">{result.valid ? <Check /> : <X />}</span>
              <div>
                <h3>{result.valid ? "Claim verified" : result.fresh === false ? "Replay rejected" : "Not verified"}</h3>
                <p>
                  {result.valid
                    ? "The proof is mathematically valid and answers exactly what you asked."
                    : errMsg(result) ?? "The proof didn't pass verification."}
                </p>
              </div>
            </div>
            <dl className="kv2">
              {Object.entries(result.claims || {}).map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}><dt>{k.replace(/_/g, " ")}</dt><dd>{k === "expires_at" && typeof v === "number" ? new Date(v * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : typeof v === "boolean" ? (v ? "Yes ✓" : "No") : String(v)}</dd></div>
              ))}
              {result.trust_level && (<><dt>Trust level</dt><dd><span className="pill">{result.trust_level}</span></dd></>)}
              {result.nullifier && (<><dt>Nullifier</dt><dd className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{result.nullifier}</dd></>)}
            </dl>
            <div className="callout info" style={{ marginTop: 20 }}>
              <Info />
              <div>
                <b>What you did not receive</b>
                <div className="pills" style={{ marginTop: 10 }}>
                  {["Name", "Date of birth", "Address", "Aadhaar number", "Photo"].map((x) => <span className="pill no" key={x}>{x}</span>)}
                </div>
              </div>
              <span />
            </div>
          </section>
        )}
        <p className="hint"><Arrow /> <span>Demo mode: calls go to the verifier API configured in <code>NEXT_PUBLIC_API_URL</code>.</span></p>
      </div>
    </div>
  );
}
