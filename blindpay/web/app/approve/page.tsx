"use client";

import { useEffect, useRef, useState } from "react";
import { api, inr, takeFragmentToken } from "@/lib/api";
import { Check, Info, X } from "@/components/icons";

type Req = {
  amount_paise: number; member_name: string; description: string; category: string; has_bill: boolean;
  vendor_gstin: string | null; invoice_number: string | null; gst_paise: number | null; itc_eligible: boolean; status: string;
};

export default function ApprovePage() {
  const token = useRef<string | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">("loading");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const consume = (first: boolean) => {
      const t = takeFragmentToken();
      if (!t) {
        if (first) setState("invalid");
        return;
      }
      token.current = t;
      setState("loading");
      setResult(null);
      api<{ request: Req }>("/approvals/view", { method: "POST", body: { token: t } })
        .then((r) => { setReq(r.request); setState("ready"); })
        .catch(() => setState("invalid"));
    };
    consume(true);
    const onHash = () => consume(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function decide(decision: "approve" | "decline") {
    if (!token.current) return;
    setBusy(decision);
    try {
      const r = await api<Req>("/approvals/decide", { method: "POST", body: { token: token.current, decision } });
      setResult(r.status === "approved" || r.status === "paid" ? "Approved. The payout has started."
        : r.status === "declined" ? "Declined. They've been told on WhatsApp." : `Status: ${r.status}`);
      setState("done");
    } catch {
      setState("invalid");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="container">
      <div className="panel center-card">
        {state === "loading" && <p className="lede" style={{ margin: 0 }}><span className="spinner" style={{ display: "inline-block", marginRight: 10 }} /> Loading the request…</p>}
        {state === "invalid" && (
          <div className="callout info" style={{ marginTop: 0 }}>
            <Info />
            <div><b>This link can't be used</b><p>Approval links work once and expire after 15 minutes. If the request is still waiting, it's in your <a href="/">dashboard</a>.</p></div><span />
          </div>
        )}
        {state === "done" && (
          <div className="callout ok" style={{ marginTop: 0 }}><Check /><div><b>Done</b><p>{result}</p></div><span /></div>
        )}
        {state === "ready" && req && (
          <>
            <span className="kicker"><span className="num">Approve?</span> {req.member_name}</span>
            <div className="big-amt">{inr(req.amount_paise)}</div>
            <p style={{ fontSize: 19, margin: "0 0 14px" }}>{req.description}</p>
            <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              <span className="chip2">{req.category}</span>
              <span className={`chip2 ${req.has_bill ? "ok" : "warn"}`}>{req.has_bill ? "bill attached" : "no bill"}</span>
              {req.vendor_gstin && <span className={`chip2 ${req.itc_eligible ? "ok" : "bad"}`}>{req.itc_eligible ? `GST credit ${inr(req.gst_paise ?? 0)}` : "no GST credit"}</span>}
            </div>
            {req.vendor_gstin && <p className="hint" style={{ marginTop: 0 }}><Info /><span>Vendor {req.vendor_gstin}, invoice {req.invoice_number}</span></p>}
            <div className="actions">
              <button className="btn btn-green" onClick={() => decide("approve")} disabled={busy !== null}>
                {busy === "approve" ? <><span className="spinner" /> Approving…</> : <><Check /> Approve and pay</>}
              </button>
              <button className="btn" onClick={() => decide("decline")} disabled={busy !== null}>
                {busy === "decline" ? <><span className="spinner" /> Declining…</> : <><X /> Decline</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
