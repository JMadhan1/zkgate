"use client";

import { useState } from "react";
import { inr } from "@/lib/api";
import { verifyPack, type Pack, type Report } from "@/lib/verifyPack";
import { Alert, Check, File as FileIcon, Info, Lock, Shield, Upload, X } from "@/components/icons";

export default function VerifyPage() {
  const [pack, setPack] = useState<Pack | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function load(f: File) {
    setError(null); setReport(null); setPack(null);
    if (f.size > 20 * 1024 * 1024 || !/\.json$/i.test(f.name)) { setError("Choose the .json Audit Pack (under 20 MB)."); return; }
    setBusy(true);
    try {
      const p = JSON.parse(await f.text()) as Pack;
      setPack(p);
      setReport(await verifyPack(p));
    } catch (e: any) {
      setError(e?.message ?? "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  const month = pack ? `${String(pack.period).slice(0, 4)}-${String(pack.period).slice(4)}` : "";

  return (
    <div className="bp">
      <div className="container-wide">
        <header className="stage bp-hero">
          <div>
            <span className="kicker"><span className="num">For CAs</span> Proof-of-policy verifier</span>
            <h1>Check every approval. <span className="serif" style={{ color: "var(--saffron)" }}>See no limits.</span></h1>
            <p className="lede">Load a client's BlindPay Audit Pack. Everything is checked in this browser: nothing is uploaded, and the pack contains no spending limit to see.</p>
          </div>
          <span className="privacy"><Lock /> Runs locally</span>
        </header>
      </div>
      <div className="container">
        <label className="drop" data-over={over} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
               onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) load(f); }}>
          <input type="file" accept=".json,application/json" aria-label="Choose an Audit Pack file" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }} />
          <span className="ic">{pack ? <FileIcon /> : <Upload />}</span>
          <b>{pack ? `${pack.company.name} · ${month}` : "Drop the Audit Pack (.json) here"}</b>
          <span>{busy ? "Verifying proofs…" : "or click to choose it"}</span>
        </label>

        {error && <div className="callout error"><Alert /><div><b>Couldn't verify</b><p>{error}</p></div><span /></div>}

        {report && pack && (
          <div className="list" style={{ marginTop: 18 }}>
            <div className="kpis">
              <div className="kpi g"><small>Approvals proved</small><b>{report.proved}</b></div>
              <div className="kpi"><small>Without a policy</small><b>{report.unproved}</b></div>
              <div className={`kpi ${report.failed ? "s" : ""}`}><small>Failed checks</small><b>{report.failed}</b></div>
              <div className={`kpi ${report.logIntact ? "g" : "s"}`}><small>Policy log</small><b>{report.logIntact ? "Intact" : "Broken"}</b></div>
            </div>
            <div className={`callout ${report.failed || !report.logIntact ? "error" : "ok"}`} style={{ marginTop: 0 }}>
              {report.failed || !report.logIntact ? <X /> : <Check />}
              <div>
                <b>{report.failed || !report.logIntact ? "This pack doesn't fully verify" : `Every proved approval in ${month} stayed inside a limit committed beforehand`}</b>
                <p>{report.logProblem ?? `Policy log of ${pack.policy_log.length} commitments chains cleanly to head ${pack.policy_log_head.slice(0, 16)}…`} Company GSTIN {pack.company.gstin ?? "not set"}.</p>
              </div><span />
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Decided</th><th>Who</th><th>What</th><th>Amount (₹)</th><th>Check</th></tr></thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.a.request_id}>
                      <td className="mono" style={{ fontSize: 13 }}>{r.a.decided_at.slice(0, 16).replace("T", " ")}</td>
                      <td>{r.a.member}</td>
                      <td>{r.a.description}<div style={{ fontSize: 12.5, color: "var(--faint)" }}>{r.a.decided_by === "policy" ? "auto-approved by policy" : "approved by owner/approver"}</div></td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{inr(r.a.amount_paise)}</td>
                      <td><span className={`chip2 ${r.ok ? "ok" : r.a.proof ? "bad" : "warn"}`}>{r.ok ? "proved" : r.a.proof ? "failed" : "no proof"}</span><div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>{r.reason}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint"><Info /><span>Each proof is a Groth16 zero-knowledge proof that the member's spend so far plus this amount is within the limit committed in the policy log, recomputed here from the pack. Verification key: development setup unless the client has published a ceremony key. Ask for its transcript.</span></p>
          </div>
        )}
        {!report && !error && <p className="hint"><Shield /><span>Your client exports the pack from BlindPay → Tally export → Audit Pack.</span></p>}
      </div>
    </div>
  );
}
