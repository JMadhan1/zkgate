"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { CLAIMS, claimById } from "@/lib/claims";
import type { ParsedAadhaar, ProofResult } from "@/lib/prove";
import { REPO_URL } from "@/lib/site";
import {
  Alert, Arrow, Calendar, Check, Copy, Download, Eye, EyeOff, File as FileIcon, Hash, Info, Lock, Pin, Repeat, Shield, Upload, User, X,
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
  const resultRef = useRef<HTMLElement>(null);

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
              The circuit artifacts (<code>{claim.circuit}.wasm</code> and{" "}
              <code>.zkey</code>) are large build outputs that aren&apos;t in the repository. Run{" "}
              <code>npm run build:circuits</code> and copy them into{" "}
              <code>frontend/public/circuits/</code> to enable live proving. Parsing and the claim
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
            Set <code>NEXT_PUBLIC_API_URL</code> to a running instance of the FastAPI backend
            (<code>backend/</code>) to verify proofs live. You can still download the proof and
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
    <div className="app">
      <div className="container-wide">
        <header className="stage app-hero">
          <div>
            <span className="kicker"><span className="num">Demo</span> Citizen portal</span>
            <h1>
              Prove it. <span className="serif" style={{ color: "var(--saffron)" }}>Keep the rest.</span>
            </h1>
            <p className="lede">
              Load an Aadhaar offline eKYC XML, pick one fact to prove, and generate a zero-knowledge proof{" "}
              <b>on this device</b>. The XML never leaves your browser.
            </p>
          </div>
          <span className="privacy"><Lock /> No upload endpoint · 100% client-side</span>
        </header>
      </div>

      <div className="container">
        <div className="app-grid">
          {/* ── Rail ─────────────────────────────────────────────── */}
          <aside className="rail" aria-label="Progress">
            <ol className="steps">
              {[
                { n: 1, t: "Load XML", d: "Parsed on this device" },
                { n: 2, t: "Pick a claim", d: "Generate the proof" },
                { n: 3, t: "Share proof", d: "Verify or download" },
              ].map((s) => {
                const state = step > s.n ? "done" : step === s.n ? "active" : "todo";
                return (
                  <li key={s.n} className="step" data-state={state} aria-current={state === "active" ? "step" : undefined}>
                    <span className="dot2">{state === "done" ? <Check /> : s.n}</span>
                    <span><b>{s.t}</b><small>{s.d}</small></span>
                  </li>
                );
              })}
            </ol>
            <div className="meter">
              <div className="top"><span>Verifier learns</span><b>{claim.reveals.length}<span style={{ fontSize: 15, color: "var(--faint)" }}> / {totalFields}</span></b></div>
              <div className="meter-bar" aria-hidden>
                {Array.from({ length: totalFields }, (_, i) => <i key={i} className={i < claim.reveals.length ? "rev" : ""} />)}
              </div>
              <div className="legend">
                <span style={{ ["--c" as string]: "var(--saffron)" }}>Shared</span>
                <span style={{ ["--c" as string]: "var(--green)" }}>Stays with you</span>
              </div>
            </div>
          </aside>

          <div>
            {/* ── Step 1 ───────────────────────────────────────────── */}
            <section className="panel" aria-labelledby="s1">
              <div className="panel-head">
                <div>
                  <h2 id="s1">Your eKYC XML</h2>
                  <p>Drop the file from your UIDAI offline eKYC download, paste it, or use a synthetic test citizen.</p>
                </div>
                <span className="tag-step">01</span>
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
                <span className="ic">{fileName ? <FileIcon /> : <Upload />}</span>
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
                <button className="btn btn-ink" onClick={() => onParse()} disabled={!xml.trim()}>
                  Parse on this device <Arrow className="arrow" />
                </button>
                <button className="btn" onClick={loadSample}>
                  <User /> Use a test citizen
                </button>
              </div>
              <p className="hint">
                <Shield />
                <span>Parsing runs entirely in your browser. Open your network tab: nothing is sent in this step.</span>
              </p>

              {problem && !parsed && <ProblemCallout p={problem} onClose={() => setProblem(null)} />}

              {parsed && (
                <div className="fade-in" style={{ marginTop: 24 }}>
                  <div className="panel-head" style={{ marginBottom: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 20 }}>What we read</h2>
                      <p>Held in memory on this device. None of it goes into the proof.</p>
                    </div>
                    <button className="btn btn-sm" onClick={() => setMasked((m) => !m)} aria-pressed={masked}>
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

            {/* ── Step 2 ───────────────────────────────────────────── */}
            <section className="panel" aria-labelledby="s2" data-dim={!parsed}>
              <div className="panel-head">
                <div>
                  <h2 id="s2">What do you want to prove?</h2>
                  <p>Each claim is its own circuit. The verifier learns the answer and nothing underneath it.</p>
                </div>
                <span className="tag-step">02</span>
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
                  <div className="pills">{claim.reveals.map((r) => <span className="pill yes" key={r}>{r}</span>)}</div>
                </div>
                <div className="keep">
                  <h4><Lock /> Stays on your device</h4>
                  <div className="pills">{claim.hidden.map((h) => <span className="pill no" key={h}>{h}</span>)}</div>
                </div>
              </div>

              <div className="actions">
                <button className="btn btn-ink" onClick={onProve} disabled={!parsed || proving}>
                  {proving ? <><span className="spinner" /> Generating proof…</> : <>Generate zero-knowledge proof <Arrow className="arrow" /></>}
                </button>
                {!parsed && <span style={{ fontSize: 14, color: "var(--faint)" }}>Load an XML first</span>}
              </div>

              {proving && (
                <div className="progress" aria-live="polite">
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

            {/* ── Step 3 ───────────────────────────────────────────── */}
            {proof && (
              <section className="panel fade-in" aria-labelledby="s3" ref={resultRef}>
                <div className="panel-head">
                  <div>
                    <h2 id="s3">Your proof is ready</h2>
                    <p>Look through it: there&apos;s no name, date of birth or address anywhere in it.</p>
                  </div>
                  <span className="tag-step">03</span>
                </div>

                <div className="ticket">
                  <div className="ticket-main">
                    <div className="ticket-top">
                      <span>ZKGATE · GROTH16 PROOF</span>
                      <span className={`badge ${proof.demo ? "warn" : "ok"}`}>{proof.demo ? "DEMO ISSUER" : "ATTESTED"}</span>
                    </div>
                    <h3>{claim.label.replace(/^I am |^I hold |^I live in /, "").replace(/^./, (c) => c.toUpperCase())} <span>✓</span></h3>
                    <div className="ticket-grid">
                      <div><small>Size</small><b>{proofBytes} B</b></div>
                      <div><small>Generated in</small><b>{elapsed ? `${(elapsed / 1000).toFixed(1)}s` : "—"}</b></div>
                      <div><small>Personal fields</small><b>0</b></div>
                    </div>
                    <div className="ticket-null">
                      <span><small style={{ display: "block", fontSize: 10.5, letterSpacing: "0.08em", marginBottom: 4 }}>NULLIFIER</small>{proof.publicSignals[1]}</span>
                      <CopyBtn text={proof.publicSignals[1]} label="nullifier" />
                    </div>
                  </div>
                  <div className="ticket-side">
                    <ProofPrint seed={proof.publicSignals.join("")} />
                    <small>proof-print · {proof.publicSignals.length} public signals</small>
                  </div>
                </div>

                <div className="actions">
                  <button className="btn btn-green" onClick={onSend} disabled={sending}>
                    {sending ? <><span className="spinner" /> Verifying…</> : <><Shield /> Send to Demo Bank</>}
                  </button>
                  <button className="btn" onClick={() => downloadJson(proof)}><Download /> Download proof</button>
                  <CopyBtn text={JSON.stringify(proof.publicSignals)} label="public signals" big />
                </div>

                {verifyResult && (
                  <div className={`callout ${verifyResult.valid ? "ok" : "error"} fade-in`} role="status">
                    {verifyResult.valid ? <Check /> : <X />}
                    <div>
                      <b>
                        {verifyResult.valid
                          ? "Verified by Demo Bank"
                          : verifyResult.fresh === false ? "Replay rejected" : "Verification failed"}
                      </b>
                      {verifyResult.valid && (
                        <div className="verify-grid">
                          {Object.entries(verifyResult.claims || {}).map(([k, v]) => (
                            <Fragment key={k}>
                              <div className="field"><small>{k.replace(/_/g, " ")}</small><b>{formatClaim(k, v)}</b></div>
                            </Fragment>
                          ))}
                        </div>
                      )}
                      {verifyResult.error && <p>{typeof verifyResult.error === "string" ? verifyResult.error : verifyResult.error.message}</p>}
                      <p style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Repeat width={14} height={14} /> Send the same proof again and it&apos;s refused as a replay: the nullifier is spent.
                      </p>
                    </div>
                    <span />
                  </div>
                )}
                {problem && proof && <ProblemCallout p={problem} onClose={() => setProblem(null)} />}
              </section>
            )}

            <p className="hint">
              <Info />
              <span>
                Demo proofs are signed with a publicly known demo issuer key, so they always report trust level
                &ldquo;demo&rdquo;. See <a href={`${REPO_URL}/blob/main/docs/UIDAI_INTEGRATION.md`} target="_blank" rel="noreferrer">UIDAI integration</a> for the production path.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatClaim(k: string, v: unknown): string {
  if (k === "expires_at" && typeof v === "number") {
    return new Date(v * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  if (typeof v === "boolean") return v ? "Yes ✓" : "No";
  return String(v);
}

function Field({ icon, k, v, masked }: { icon: React.ReactNode; k: string; v: string; masked: boolean }) {
  return (
    <div className="field" data-masked={masked}>
      <small>{icon} {k}</small>
      <b>{v}</b>
    </div>
  );
}

function CopyBtn({ text, label, big }: { text: string; label: string; big?: boolean }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1400);
    } catch {}
  }
  if (big) {
    return <button className="btn" onClick={copy} aria-label={`Copy ${label}`}>{done ? <Check /> : <Copy />} {done ? "Copied" : "Copy signals"}</button>;
  }
  return <button className="copy" onClick={copy} aria-label={`Copy ${label}`}>{done ? <Check /> : <Copy />} {done ? "Copied" : "Copy"}</button>;
}

/** A 12×12 glyph derived from the proof's public signals: a visual fingerprint. */
function ProofPrint({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    const out: string[] = [];
    for (let i = 0; i < 144; i++) {
      h ^= seed.charCodeAt(i % seed.length) + i;
      h = Math.imul(h, 16777619) >>> 0;
      const v = h % 10;
      out.push(v < 4 ? "o" : v < 5 ? "s" : v < 6 ? "g" : "");
    }
    // mirror left half to right for a crest-like symmetric print
    for (let row = 0; row < 12; row++) for (let col = 6; col < 12; col++) out[row * 12 + col] = out[row * 12 + (11 - col)];
    return out;
  }, [seed]);
  return (
    <div className="proofprint" aria-hidden>
      {cells.map((c, i) => <i key={i} className={c} />)}
    </div>
  );
}

function ProblemCallout({ p, onClose }: { p: Problem; onClose: () => void }) {
  return (
    <div className={`callout ${p.kind} fade-in`} role={p.kind === "error" ? "alert" : "status"}>
      {p.kind === "error" ? <Alert /> : <Info />}
      <div>
        <b>{p.title}</b>
        <p>{p.body}</p>
      </div>
      <button className="x-btn" onClick={onClose} aria-label="Dismiss"><X /></button>
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
