"use client";

import { useEffect, useState } from "react";
import { api, takeFragmentToken } from "@/lib/api";
import { Arrow, Lock } from "@/components/icons";

type Phase = "checking" | "form" | "sent" | "signing-in" | "failed";

export default function LoginPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Runs on load and whenever a new link is opened in an already-open tab
    // (a fragment change doesn't reload the page).
    const consume = () => {
      const token = takeFragmentToken();
      if (!token) {
        setPhase((p) => (p === "checking" ? "form" : p));
        return;
      }
      setPhase("signing-in");
      api("/auth/session", { method: "POST", body: { token } })
        .then(() => window.location.replace("/"))
        .catch(() => setPhase("failed"));
    };
    consume();
    window.addEventListener("hashchange", consume);
    return () => window.removeEventListener("hashchange", consume);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
    const e164 = digits.length === 10 ? "91" + digits : digits;
    if (!/^91[6-9]\d{9}$/.test(e164)) {
      setError("Enter a 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/login-link", { method: "POST", body: { phone: e164 } });
      setPhase("sent");
    } catch (err: any) {
      setError(err?.status === 429 ? "Too many attempts. Try again in a few minutes." : "Couldn't send the link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="panel center-card">
        {phase === "checking" || phase === "signing-in" ? (
          <p className="lede" style={{ margin: 0 }}><span className="spinner" style={{ display: "inline-block", marginRight: 10 }} /> Signing you in…</p>
        ) : phase === "sent" ? (
          <>
            <span className="kicker"><span className="num">Sent</span> Check WhatsApp</span>
            <h2 style={{ fontSize: 34, margin: "14px 0 10px" }}>Tap the link we sent.</h2>
            <p className="lede" style={{ margin: 0 }}>If that number belongs to an owner or approver, a sign-in link is on its way. It works once and expires in 15 minutes.</p>
          </>
        ) : (
          <form onSubmit={send} className="form">
            <span className="kicker"><span className="num">Owner</span> Sign in</span>
            <h2 style={{ fontSize: 34, margin: "4px 0 0" }}>Sign in with WhatsApp.</h2>
            <p className="lede" style={{ margin: 0 }}>No password: we send a one-time link to your number.</p>
            {phase === "failed" && <div className="callout error"><Lock /><div><b>That link didn't work</b><p>It may have expired or been used already. Ask for a new one below.</p></div><span /></div>}
            <label className="field2">
              <span>Mobile number</span>
              <input className="input" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone}
                     onChange={(e) => setPhone(e.target.value)} aria-describedby="login-err" />
            </label>
            {error && <p id="login-err" style={{ color: "var(--red)", margin: 0, fontSize: 14 }}>{error}</p>}
            <button className="btn btn-ink" disabled={busy}>{busy ? <><span className="spinner" /> Sending…</> : <>Send sign-in link <Arrow className="arrow" /></>}</button>
          </form>
        )}
      </div>
    </div>
  );
}
