"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { CLAIMS, claimById } from "@/lib/claims";
import type { ParsedAadhaar, ProofResult } from "@/lib/prove";
import { REPO_URL } from "@/lib/site";
import {
  Alert, Arrow, Calendar, Check, Copy, Download, Eye, EyeOff, File, Hash, Info, Lock, Pin, Repeat, Shield, Upload, User, X,
} from "@/components/icons";

// Verifier API. In local dev it defaults to the FastAPI backend; in production
// it must be configured explicitly (NEXT_PUBLIC_API_URL) or the "send" step
// explains that no verifier is connected.
const API =
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

// The demo verifier "99999" (Demo Bank). A real citizen scans a verifier's
// request; here it's hardcoded so the page is self-contained.
const DEMO_VERIFIER = "99999";

// Real eKYC XMLs are tens of KB (mostly the photo). Anything far larger is not one.
const MAX_XML_BYTES = 2 * 1024 * 1024;

/**
 * Cheap structural checks before the XML reaches the parser. The SDK parser
 * never expands entities, but we refuse DTDs outright (XXE / entity-expansion
 * hygiene), plus NUL bytes and oversized input.
 */
function checkXml(text: string): string | null {
  if (new Blob([text]).size > MAX_XML_BYTES) return "That file is too large to be an offline eKYC XML (max 2 MB).";
  if (text.includes("\u0000")) return "The XML contains NUL bytes, so it can't be an eKYC file.";
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return "XML with a DOCTYPE or ENTITY declaration isn't accepted.";
  if (!/<OfflinePaperlessKyc[\s>]/.test(text)) return "This doesn't look like a UIDAI offline eKYC XML (no <OfflinePaperlessKyc> element).";
  return null;
}

type ProveStage = "idle" | "artifacts" | "witness" | "prove";
type Problem = { kind: "error" | "info"; title: string; body: React.ReactNode };

function thresholdFor(id: string) {
  return id === "age_above_21" ? 21 : id === "age_above_60" ? 60 : 18;
}

export default function ProvePage() {
  const [xml, setXml] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedAadhaar | null>(null);
  const [masked, setMasked] = useState(false);
  const [claimId, setClaimId] = useState("age_above_18");
  const [stage, setStage] = useState<ProveStage>("idle");
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const claim = claimById(claimId)!;
  const step = proof ? 3 : parsed ? 2 : 1;
  const proving = stage !== "idle";

  const proofBytes = useMemo(
    () => (proof ? new TextEncoder().encode(JSON.stringify(proof.proof)).length : 0),
    [proof],
  );

  // ── Step 1: load & parse ────────────────────────────────────────────
  async function readFile(f: File) {
    setProblem(null);
    if (!/\.xml$/i.test(f.name) || (f.type && !/xml/.test(f.type))) {
      setProblem({ kind: "error", title: "Not an XML file", body: "Choose the .xml file from your UIDAI offline eKYC download." });
      return;
    }
    if (f.size > MAX_XML_BYTES) {
      setProblem({ kind: "error", title: "File too large", body: "Offline eKYC XMLs are well under 2 MB." });
      return;
    }
    setFileName(f.name);
    setXml((await f.text()).normalize("NFC"));
    setParsed(null);
    setProof(null);
    setVerifyResult(null);
  }

  async function onParse(source = xml) {
    setProblem(null);
    const bad = checkXml(source);
    if (bad) {
      setProblem({ kind: "error", title: "Couldn't read that XML", body: bad });
      return;
    }
    try {
      const { parse } = await import("@/lib/prove");
      const p = await parse(source);
      setParsed(p);
      setProof(null);
      setVerifyResult(null);
    } catch (e: any) {
      setProblem({ kind: "error", title: "Couldn't read that XML", body: e?.message || String(e) });
    }
  }

  function loadSample() {
    setXml(SAMPLE_XML);
    setFileName(null);
    onParse(SAMPLE_XML);
  }

  // ── Step 2: prove ───────────────────────────────────────────────────
  async function onProve() {
    if (!parsed) return;
    setProblem(null);
    setProof(null);
    setVerifyResult(null);
    setStage("artifacts");
    const t0 = performance.now();
    try {
      // Fail fast, and clearly, if the proving artifacts aren't deployed.
      const head = await fetch(`/circuits/${claim.circuit}.wasm`, { method: "HEAD" });
      if (!head.ok) {
        setProblem({
          kind: "info",
          title: "Proving keys aren't published on this deployment yet",
          body: (
            <>
              The circuit artifacts (<code className="code-chip">{claim.circuit}.wasm</code> and{" "}
              <code className="code-chip">.zkey</code>) are large build outputs that aren&apos;t in the repository. Run{" "}
              <code className="code-chip">npm run build:circuits</code> and copy them into{" "}
              <code className="code-chip">frontend/public/circuits/</code> to enable live proving. Parsing and the claim
              preview above already run fully on your device.
            </>
          ),
        });
        return;
      }
      const { prove } = await import("@/lib/prove");
      const result = await prove({
        xml,
        parsed,
        claimType: claim.id,
        circuit: claim.circuit,
        verifierId: DEMO_VERIFIER,
        ageThreshold: thresholdFor(claim.id),
        requiredStateCode: parsed.fields.state_code,
        onStage: (s) => setStage(s),
      });
      setProof(result);
      setElapsed(performance.now() - t0);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e: any) {
      setProblem({
        kind: "error",
        title: "The circuit refused to build a proof",
        body: (
          <>
            {e?.message || String(e)}
            <br />
            For a claim you don&apos;t satisfy (proving 60+ when younger, for example), the circuit refuses to produce
            a proof at all. That&apos;s the design working.
          </>
        ),
      });
    } finally {
      setStage("idle");
    }
  }

  // ── Step 3: verify ──────────────────────────────────────────────────
  async function onSend() {
    if (!proof) return;
    setProblem(null);
    if (!API) {
      setProblem({
        kind: "info",
        title: "No verifier API is connected to this deployment",
        body: (
          <>
            Set <code className="code-chip">NEXT_PUBLIC_API_URL</code> to a running instance of the FastAPI backend
            (<code className="code-chip">backend/</code>) to verify proofs live. You can still download the proof and
            verify it yourself.
          </>
        ),
      });
      return;
    }
    setSending(true);
    try {
      const body = {
        proof_bundle: {
          proof: proof.proof,
          public_signals: proof.publicSignals,
          claim_type: proof.claimType,
          generated_at: proof.generatedAt,
          demo: proof.demo,
        },
        verifier_id: DEMO_VERIFIER,
        expected: {
          age_threshold: thresholdFor(claim.id),
          required_state_code: parsed?.fields.state_code ?? 0,
        },
      };
      const res = await fetch(`${API}/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setVerifyResult(await res.json());
    } catch (e: any) {
      setProblem({ kind: "error", title: "Couldn't reach the verifier", body: `${API}: ${e?.message || e}` });
    } finally {
      setSending(false);
    }
  }

  function pickClaim(id: string) {
    setClaimId(id);
    setProof(null);
    setVerifyResult(null);
    setProblem(null);
  }

  const totalFields = claim.reveals.length + claim.hidden.length;

  return (
    <div className="container app">
      <header className="app-head">
        <div>
          <span className="eyebrow">Citizen portal · demo</span>
          <h1>
            Prove who you are. <span className="serif tri-text">Reveal nothing.</span>
          </h1>
          <p className="lede">
            Load an Aadhaar offline eKYC XML, choose what to prove, and generate a cryptographic proof{" "}
            <strong>on this device</strong>. The XML never leaves your browser. Only the proof does.
          </p>
        </div>
        <span className="privacy-pill"><Lock /> No upload endpoint · 100% client-side</span>
      </header>

      <div className="app-grid">
        {/* ── Rail ─────────────────────────────────────────────────── */}
        <aside className="rail" aria-label="Progress">
          <ol className="steps">
            {[
              { n: 1, t: "Load your XML", d: "Parsed locally" },
              { n: 2, t: "Choose a claim", d: "Generate the proof" },
              { n: 3, t: "Share the proof", d: "Verify or download" },
            ].map((s) => {
              const state = step > s.n ? "done" : step === s.n ? "active" : "todo";
              return (
                <li key={s.n} className="step" data-state={state} aria-current={state === "active" ? "step" : undefined}>
                  <span className="dot">{state === "done" ? <Check /> : s.n}</span>
                  <span><b>{s.t}</b><small>{s.d}</small></span>
                </li>
              );
            })}
          </ol>
          <div className="card meter">
            <div className="row"><span>Disclosure for this claim</span><b>{claim.reveals.length}/{totalFields}</b></div>
            <div className="meter-bar" aria-hidden>
              <i className="rev" style={{ width: `${(claim.reveals.length / totalFields) * 100}%` }} />
              <i className="hid" style={{ width: `${(claim.hidden.length / totalFields) * 100}%` }} />
            </div>
            <div className="meter-legend">
              <span style={{ ["--c" as string]: "var(--saffron)" }}>Verifier learns</span>
              <span style={{ ["--c" as string]: "var(--green)" }}>Stays private</span>
            </div>
          </div>
        </aside>

        <div>
          {/* ── Step 1 ───────────────────────────────────────────────── */}
          <section className="panel" aria-labelledby="s1">
            <div className="panel-head">
              <div>
                <h2 id="s1">Your Aadhaar XML</h2>
                <p>Drop your UIDAI offline eKYC file, paste its contents, or use a synthetic test citizen.</p>
              </div>
              <span className="step-tag">Step 01</span>
            </div>

            <label
              className="drop"
              data-over={dragOver}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) readFile(f);
              }}
            >
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                aria-label="Choose an Aadhaar offline eKYC XML file"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
              />
              {fileName ? <File /> : <Upload />}
              <b>{fileName ?? "Drop your eKYC .xml here"}</b>
              <span>{fileName ? "Loaded into memory, not uploaded" : "or click to browse · read locally, never uploaded"}</span>
            </label>

            <div className="or">or paste</div>

            <textarea
              className="xml"
              value={xml}
              onChange={(e) => { setXml(e.target.value); setFileName(null); }}
              placeholder='<?xml version="1.0"?><OfflinePaperlessKyc …>'
              aria-label="Aadhaar XML contents"
              spellCheck={false}
            />

            <div className="actions">
              <button className="btn btn-primary" onClick={() => onParse()} disabled={!xml.trim()}>
                Parse on this device <Arrow className="arrow" />
              </button>
              <button className="btn" onClick={loadSample}>
                <User /> Use test citizen (28, Andhra Pradesh)
              </button>
            </div>
            <p className="hint">
              <Shield />
              <span>Parsing runs entirely in your browser. Open your network tab: no request is made in this step.</span>
            </p>

            {problem && !parsed && <ProblemCallout p={problem} onClose={() => setProblem(null)} />}

            {parsed && (
              <div className="fade-in" style={{ marginTop: 22 }}>
                <div className="panel-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 17 }}>What we read</h2>
                    <p>Held in memory on this device. None of it goes into the proof.</p>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setMasked((m) => !m)} aria-pressed={masked}>
                    {masked ? <Eye /> : <EyeOff />} {masked ? "Show" : "Hide"}
                  </button>
                </div>
                <div className="fields">
                  <Field icon={<User />} k="Name" v={parsed.raw.name} masked={masked} />
                  <Field icon={<Calendar />} k="Date of birth" v={parsed.raw.dob} masked={masked} />
                  <Field icon={<Pin />} k="State" v={`${parsed.raw.stateName} · code ${parsed.fields.state_code}`} masked={masked} />
                  <Field icon={<Hash />} k="District / PIN" v={`${parsed.raw.district}, ${parsed.raw.pincode}`} masked={masked} />
                </div>
              </div>
            )}
          </section>

          {/* ── Step 2 ───────────────────────────────────────────────── */}
          <section className="panel" aria-labelledby="s2" data-dim={!parsed}>
            <div className="panel-head">
              <div>
                <h2 id="s2">What do you want to prove?</h2>
                <p>Each claim is its own circuit. The verifier learns the answer and nothing underneath it.</p>
              </div>
              <span className="step-tag">Step 02</span>
            </div>

            <div className="claim-grid" role="radiogroup" aria-label="Claim to prove">
              {CLAIMS.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={claimId === c.id}
                  className="claim-opt"
                  onClick={() => pickClaim(c.id)}
                  disabled={proving}
                >
                  <span className="radio" aria-hidden />
                  <span className="t">{c.label}</span>
                  <span className="d">{c.blurb}</span>
                  <span className="m">{c.circuit}.circom</span>
                </button>
              ))}
            </div>

            <div className="disclose">
              <div className="learn">
                <h4><Eye /> The verifier learns</h4>
                <div className="tags">{claim.reveals.map((r) => <span className="tag learn" key={r}>{r}</span>)}</div>
              </div>
              <div className="keep">
                <h4><Lock /> Stays on your device</h4>
                <div className="tags">{claim.hidden.map((h) => <span className="tag hide" key={h}>{h}</span>)}</div>
              </div>
            </div>

            <div className="actions">
              <button className="btn btn-primary" onClick={onProve} disabled={!parsed || proving}>
                {proving ? <><span className="spinner" /> Generating proof…</> : <>Generate zero-knowledge proof <Arrow className="arrow" /></>}
              </button>
              {!parsed && <span style={{ fontSize: 13.5, color: "var(--faint)" }}>Load an XML first</span>}
            </div>

            {proving && (
              <div className="progress-steps" aria-live="polite">
                {([
                  ["artifacts", "Fetching circuit artifacts"],
                  ["witness", "Signing demo credential & building witness"],
                  ["prove", "Running the Groth16 prover"],
                ] as const).map(([key, label], idx, arr) => {
                  const cur = arr.findIndex(([k]) => k === stage);
                  const st = idx < cur ? "done" : idx === cur ? "active" : "todo";
                  return (
                    <div className="pstep" data-state={st} key={key}>
                      {st === "done" ? <Check /> : st === "active" ? <span className="spinner" /> : <span className="dotty" />}
                      {label}
                    </div>
                  );
                })}
              </div>
            )}

            {problem && parsed && !proof && <ProblemCallout p={problem} onClose={() => setProblem(null)} />}
          </section>

          {/* ── Step 3 ───────────────────────────────────────────────── */}
          {proof && (
            <section className="panel fade-in" aria-labelledby="s3" ref={resultRef}>
              <div className="panel-head">
                <div>
                  <h2 id="s3">Your proof is ready</h2>
                  <p>
                    {proofBytes} bytes{elapsed ? ` · generated in ${(elapsed / 1000).toFixed(1)}s` : ""}. Look through it:
                    there&apos;s no name, date of birth or address anywhere in it.
                  </p>
                </div>
                <span className="step-tag">Step 03</span>
              </div>

              <div className="proof-box">
                <ProofRow k="Claim" v={proof.claimType} />
                <ProofRow k="Trust level" v={<span className={`badge ${proof.demo ? "warn" : "ok"}`}>{proof.demo ? "demo" : "attested"}</span>} />
                <ProofRow k="Nullifier" v={proof.publicSignals[1]} copy={proof.publicSignals[1]} />
                <ProofRow k="Public signals" v={`[${proof.publicSignals.join(", ")}]`} copy={JSON.stringify(proof.publicSignals)} />
              </div>

              <div className="actions">
                <button className="btn btn-green" onClick={onSend} disabled={sending}>
                  {sending ? <><span className="spinner" /> Verifying…</> : <><Shield /> Send to Demo Bank</>}
                </button>
                <button className="btn" onClick={() => downloadJson(proof)}><Download /> Download proof</button>
              </div>

              {verifyResult && (
                <div className={`callout ${verifyResult.valid ? "ok" : "error"} fade-in`}>
                  {verifyResult.valid ? <Check /> : <X />}
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <b>
                        {verifyResult.valid
                          ? "Verified by Demo Bank"
                          : verifyResult.fresh === false ? "Replay rejected" : "Verification failed"}
                      </b>
                      {verifyResult.trust_level && <span className="badge warn">{verifyResult.trust_level}</span>}
                    </div>
                    <div className="verify-grid">
                      {Object.entries(verifyResult.claims || {}).map(([k, v]) => (
                        <Fragment key={k}>
                          <div className="field"><small>{k}</small><b>{String(v)}</b></div>
                        </Fragment>
                      ))}
                    </div>
                    {verifyResult.error && <p style={{ color: "var(--danger)" }}>{verifyResult.error}</p>}
                    <p style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Repeat width={14} height={14} /> Send the same proof again and the verifier rejects it as a replay,
                      because the nullifier is spent.
                    </p>
                  </div>
                </div>
              )}
              {problem && proof && <ProblemCallout p={problem} onClose={() => setProblem(null)} />}
            </section>
          )}

          <p className="hint" style={{ marginTop: 6 }}>
            <Info />
            <span>
              Demo proofs are signed with a publicly known demo issuer key, so they always report trust level
              &ldquo;demo&rdquo;. See{" "}
              <a href={`${REPO_URL}/blob/main/docs/UIDAI_INTEGRATION.md`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                UIDAI integration
              </a>{" "}
              for the production path.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, k, v, masked }: { icon: React.ReactNode; k: string; v: string; masked: boolean }) {
  return (
    <div className="field" data-masked={masked}>
      <small>{icon} {k}</small>
      <b>{v}</b>
    </div>
  );
}

function ProofRow({ k, v, copy }: { k: string; v: React.ReactNode; copy?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="proof-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {copy ? (
        <button
          className="copy"
          onClick={async () => {
            try { await navigator.clipboard.writeText(copy); setDone(true); setTimeout(() => setDone(false), 1400); } catch {}
          }}
          aria-label={`Copy ${k}`}
        >
          {done ? <Check /> : <Copy />} {done ? "Copied" : "Copy"}
        </button>
      ) : <span />}
    </div>
  );
}

function ProblemCallout({ p, onClose }: { p: Problem; onClose: () => void }) {
  return (
    <div className={`callout ${p.kind} fade-in`} role={p.kind === "error" ? "alert" : "status"}>
      {p.kind === "error" ? <Alert /> : <Info />}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <b>{p.title}</b>
          <button className="copy" onClick={onClose} aria-label="Dismiss"><X /></button>
        </div>
        <p>{p.body}</p>
      </div>
    </div>
  );
}

function downloadJson(obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zkgate-proof.json";
  a.click();
  URL.revokeObjectURL(url);
}

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OfflinePaperlessKyc referenceId="xxxx1234567890" ts="2026-07-10T14:23:00" ver="1.0">
  <UidData uid="xxxx-xxxx-3632">
    <Poi dob="10-07-1998" gender="M" name="Madhan Kumar"/>
    <Poa co="S/O Suresh Kumar" dist="Chittoor" house="12/4"
         lm="Near APSRTC Bus Stand" loc="Ganesh Nagar"
         pc="517001" po="Chittoor HO"
         state="Andhra Pradesh" street="MG Road"
         subdist="Chittoor" vtc="Chittoor"/>
    <Pht>iVBORw0KGgoAAAANSUhEUg==</Pht>
  </UidData>
  <Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ds:SignatureValue>DEMO_SYNTHETIC_SIGNATURE</ds:SignatureValue>
  </Signature>
</OfflinePaperlessKyc>`;
