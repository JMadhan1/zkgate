"use client";

import { useCallback, useEffect, useState } from "react";
import { api, inr, setCsrf } from "@/lib/api";
import { Check, Download, Info, Lock, Shield, User, X } from "@/components/icons";

type Session = { member: { id: string; name: string; role: string }; company: { id: string; name: string; gstin: string | null; plan: string; plan_status: string }; csrf_token: string };
type Req = { id: string; member_name: string; amount_paise: number; category: string; description: string; status: string; decline_reason: string | null; has_bill: boolean; vendor_gstin: string | null; itc_eligible: boolean; gst_paise: number | null; created_at: string };
type Member = { id: string; name: string; phone_last4: string; role: string; grade: string | null; active: boolean; consented: boolean; has_upi: boolean };
type Stats = { month: string; paid_paise: number; approved_unpaid_paise: number; pending_count: number; declined_count: number; itc_eligible_gst_paise: number; itc_missed_count: number };
type Tab = "approvals" | "requests" | "team" | "export" | "audit" | "plan";

const STATUS: Record<string, [string, string]> = {
  pending_approval: ["waiting", "warn"], approved: ["approved", "ok"], paid: ["paid", "ok"],
  declined: ["declined", "bad"], payout_failed: ["payout failed", "bad"],
};

export default function Dashboard() {
  const [s, setS] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("approvals");
  const [stats, setStats] = useState<Stats | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [seats, setSeats] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    const [st, rq, mb] = await Promise.all([
      api<Stats>("/stats"), api<{ requests: Req[] }>("/requests?limit=100"), api<{ members: Member[]; seats: number }>("/members"),
    ]);
    setStats(st); setReqs(rq.requests); setMembers(mb.members); setSeats(mb.seats);
  }, []);

  useEffect(() => {
    api<Session>("/session")
      .then((sess) => { setCsrf(sess.csrf_token); setS(sess); return load(); })
      .catch(() => window.location.replace("/login"));
  }, [load]);

  if (!s) return <div className="container bp"><p className="lede"><span className="spinner" style={{ display: "inline-block", marginRight: 10 }} />Loading…</p></div>;

  const owner = s.member.role === "owner";
  const pending = reqs.filter((r) => r.status === "pending_approval");
  const tabs: [Tab, string][] = [["approvals", `Approvals${pending.length ? ` (${pending.length})` : ""}`], ["requests", "All requests"], ["team", "Team & limits"], ["export", "Tally export"], ["audit", "Audit trail"], ...(owner ? [["plan", "Plan"] as [Tab, string]] : [])];

  return (
    <div className="bp">
      <div className="container-wide">
        <header className="stage bp-hero">
          <div>
            <span className="kicker"><span className="num">{s.company.plan}</span> {s.company.gstin ? `GSTIN ${s.company.gstin}` : "No GSTIN set"}</span>
            <h1>{s.company.name}</h1>
            <p className="lede">Signed in as {s.member.name} ({s.member.role}). Employees send requests on WhatsApp; you decide here or from the WhatsApp link.</p>
          </div>
          <button className="btn btn-ghost-light btn-sm" onClick={async () => { await api("/auth/logout", { method: "POST" }); window.location.replace("/login"); }}>Sign out</button>
        </header>
      </div>

      <div className="container">
        {stats && (
          <div className="kpis">
            <div className="kpi"><small>Paid · {stats.month}</small><b>{inr(stats.paid_paise)}</b></div>
            <div className="kpi s"><small>Waiting for you</small><b>{stats.pending_count}</b></div>
            <div className="kpi g"><small>GST credit to claim</small><b>{inr(stats.itc_eligible_gst_paise)}</b></div>
            <div className="kpi"><small>Bills with no GST credit</small><b>{stats.itc_missed_count}</b></div>
          </div>
        )}

        <div className="tabs" role="tablist" aria-label="Sections">
          {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
        </div>

        {tab === "approvals" && <Approvals pending={pending} onDone={async (m) => { flash(m); await load(); }} />}
        {tab === "requests" && <Requests reqs={reqs} />}
        {tab === "team" && <Team members={members} seats={seats} owner={owner} onChange={async (m) => { flash(m); await load(); }} />}
        {tab === "export" && <Export />}
        {tab === "audit" && <Audit />}
        {tab === "plan" && owner && <Plan plan={s.company.plan} />}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Pill({ status }: { status: string }) {
  const [label, kind] = STATUS[status] ?? [status, ""];
  return <span className={`chip2 ${kind}`}>{label}</span>;
}

function Approvals({ pending, onDone }: { pending: Req[]; onDone: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function decide(r: Req, decision: "approve" | "decline") {
    setBusy(r.id + decision);
    try {
      const out = await api<Req>(`/requests/${r.id}/decision`, { method: "POST", body: { decision } });
      onDone(out.status === "declined" ? `Declined ${inr(r.amount_paise)}` : `Approved ${inr(r.amount_paise)}; payout started`);
    } catch (e: any) {
      onDone(e?.message ?? "Couldn't save that decision");
    } finally {
      setBusy(null);
    }
  }
  if (!pending.length) return <div className="empty">Nothing waiting. New requests from WhatsApp show up here.</div>;
  return (
    <div className="list">
      {pending.map((r) => (
        <article className="req" key={r.id}>
          <div>
            <div className="who">{r.member_name} · {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
            <div className="amt">{inr(r.amount_paise)}</div>
            <div className="desc">{r.description}</div>
            <div className="meta">
              <span className="chip2">{r.category}</span>
              <span className={`chip2 ${r.has_bill ? "ok" : "warn"}`}>{r.has_bill ? "bill" : "no bill"}</span>
              {r.vendor_gstin && <span className={`chip2 ${r.itc_eligible ? "ok" : "bad"}`}>{r.itc_eligible ? `GST ${inr(r.gst_paise ?? 0)} claimable` : "no GST credit"}</span>}
            </div>
          </div>
          <div className="btns">
            <button className="btn btn-green btn-sm" disabled={busy !== null} onClick={() => decide(r, "approve")}>{busy === r.id + "approve" ? <span className="spinner" /> : <Check />} Approve</button>
            <button className="btn btn-sm" disabled={busy !== null} onClick={() => decide(r, "decline")}>{busy === r.id + "decline" ? <span className="spinner" /> : <X />} Decline</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Requests({ reqs }: { reqs: Req[] }) {
  if (!reqs.length) return <div className="empty">No requests yet.</div>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Amount (₹)</th><th>GST</th><th>Status</th></tr></thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
              <td>{r.member_name}</td>
              <td>{r.description}{r.decline_reason ? <div style={{ fontSize: 13, color: "var(--muted)" }}>{r.decline_reason}</div> : null}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{inr(r.amount_paise)}</td>
              <td>{r.vendor_gstin ? (r.itc_eligible ? <span className="chip2 ok">credit</span> : <span className="chip2 bad">none</span>) : "—"}</td>
              <td><Pill status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Team({ members, seats, owner, onChange }: { members: Member[]; seats: number; owner: boolean; onChange: (m: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("employee");
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const active = members.filter((m) => m.active).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const digits = phone.replace(/\D/g, "");
    const e164 = digits.length === 10 ? "91" + digits : digits;
    try {
      await api("/members", { method: "POST", body: { name: name.trim(), phone: e164, role } });
      setName(""); setPhone("");
      onChange("Added. They'll get a WhatsApp message to agree before they can use BlindPay.");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't add that person");
    }
  }

  return (
    <div className="list">
      <p className="hint" style={{ marginTop: 0 }}><Info /><span>{active} of {seats} seats used. Limits are stored encrypted. Employees never see them, and a decline names the rule, not the number.</span></p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Status</th>{owner && <th />}</tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td><td>•••• {m.phone_last4}</td><td>{m.role}</td>
                <td>{!m.active ? <span className="chip2">inactive</span> : !m.consented ? <span className="chip2 warn">awaiting AGREE</span> : !m.has_upi && m.role === "employee" ? <span className="chip2 warn">no UPI yet</span> : <span className="chip2 ok">ready</span>}</td>
                {owner && <td>{m.role !== "owner" && <button className="btn btn-sm" onClick={() => setEditing(editing === m.id ? null : m.id)}><Lock /> Limits</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && owner && <PolicyEditor memberId={editing} name={members.find((m) => m.id === editing)?.name ?? ""} onSaved={(m) => { setEditing(null); onChange(m); }} />}
      {owner && (
        <form className="panel form" onSubmit={add}>
          <h3 style={{ fontSize: 22 }}>Add a team member</h3>
          <div className="form-row">
            <label className="field2"><span>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
            <label className="field2"><span>WhatsApp number</span><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" required /></label>
            <label className="field2"><span>Role</span><select className="input" value={role} onChange={(e) => setRole(e.target.value)}><option value="employee">Employee</option><option value="approver">Approver</option></select></label>
            <button className="btn btn-ink"><User /> Add</button>
          </div>
          {err && <p style={{ color: "var(--red)", margin: 0 }}>{err}</p>}
        </form>
      )}
    </div>
  );
}

function rupeesToPaise(v: string): number | null {
  const n = Number(v.replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function PolicyEditor({ memberId, name, onSaved }: { memberId: string; name: string; onSaved: (m: string) => void }) {
  const [monthly, setMonthly] = useState("");
  const [cap, setCap] = useState("");
  const [auto, setAuto] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ policy: any }>(`/members/${memberId}/policy`).then(({ policy }) => {
      if (!policy) return;
      setMonthly(String(policy.monthly_limit_paise / 100));
      if (policy.per_request_cap_paise) setCap(String(policy.per_request_cap_paise / 100));
      if (policy.auto_approve_under_paise) setAuto(String(policy.auto_approve_under_paise / 100));
    }).catch(() => {});
  }, [memberId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const m = rupeesToPaise(monthly);
    if (!m) { setErr("Enter a monthly limit in rupees."); return; }
    const body: Record<string, number> = { monthly_limit_paise: m };
    const c = cap ? rupeesToPaise(cap) : null;
    const a = auto ? rupeesToPaise(auto) : null;
    if (c) body.per_request_cap_paise = c;
    if (a) body.auto_approve_under_paise = a;
    try {
      const r = await api<{ version: number }>(`/members/${memberId}/policy`, { method: "PUT", body });
      onSaved(`Limits saved for ${name} (version ${r.version})`);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't save");
    }
  }

  return (
    <form className="panel form" onSubmit={save}>
      <h3 style={{ fontSize: 22 }}><Shield width={20} height={20} style={{ display: "inline", verticalAlign: -3 }} /> Limits for {name}</h3>
      <div className="form-row">
        <label className="field2"><span>Monthly limit (₹)</span><input className="input" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} required /><small>Rounded down to ₹500</small></label>
        <label className="field2"><span>Max per request (₹)</span><input className="input" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} /><small>Optional</small></label>
        <label className="field2"><span>Auto-approve under (₹)</span><input className="input" inputMode="decimal" value={auto} onChange={(e) => setAuto(e.target.value)} /><small>Optional: no tap needed below this</small></label>
        <button className="btn btn-ink"><Lock /> Save encrypted</button>
      </div>
      {err && <p style={{ color: "var(--red)", margin: 0 }}>{err}</p>}
    </form>
  );
}

function Export() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  return (
    <div className="panel form">
      <h3 style={{ fontSize: 22 }}>Export paid requests to Tally</h3>
      <p className="lede" style={{ margin: 0, fontSize: 16 }}>One Payment voucher per paid request: debit the expense ledger for its category, credit your RazorpayX ledger. In TallyPrime: Import → Transactions → XML.</p>
      <div className="form-row">
        <label className="field2"><span>Month</span><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <a className="btn btn-ink" href={`/api/v1/exports/tally?month=${encodeURIComponent(month)}`} download><Download /> Download XML</a>
      </div>
    </div>
  );
}

function Audit() {
  const [data, setData] = useState<{ chain_intact: boolean; events: { seq: number; ts: string; actor: string; action: string; resource: string }[] } | null>(null);
  useEffect(() => { api("/audit?limit=100").then(setData).catch(() => {}); }, []);
  if (!data) return <div className="empty"><span className="spinner" style={{ display: "inline-block" }} /></div>;
  return (
    <div className="list">
      <div className={`callout ${data.chain_intact ? "ok" : "error"}`} style={{ marginTop: 0 }}>
        {data.chain_intact ? <Check /> : <X />}
        <div><b>{data.chain_intact ? "Audit chain intact" : "Audit chain broken"}</b><p>Every event's hash covers the one before it, so edited or deleted history shows up here.</p></div><span />
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>#</th><th>When (UTC)</th><th>Who</th><th>What</th></tr></thead>
          <tbody>{data.events.map((e) => <tr key={e.seq}><td>{e.seq}</td><td className="mono" style={{ fontSize: 13 }}>{e.ts.replace("T", " ").slice(0, 19)}</td><td className="mono" style={{ fontSize: 13 }}>{e.actor.replace(/^member:/, "").slice(0, 8)}</td><td>{e.action}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Plan({ plan }: { plan: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function go(p: "team" | "business") {
    setBusy(p);
    try {
      const r = await api<{ checkout_url: string }>("/billing/subscribe", { method: "POST", body: { plan: p } });
      window.location.assign(r.checkout_url);
    } catch {
      setBusy(null);
    }
  }
  const plans: [string, string, string, "team" | "business" | null][] = [
    ["free", "Free", "Up to 3 people, 30 requests a month", null],
    ["team", "Team · ₹1,999/mo", "Up to 15 people, UPI payouts, GST capture, Tally export", "team"],
    ["business", "Business · ₹4,999/mo", "Up to 50 people, approvers, everything in Team", "business"],
  ];
  return (
    <div className="list">
      {plans.map(([key, title, body, target]) => (
        <article className="req" key={key}>
          <div><div className="amt" style={{ fontSize: 20 }}>{title}</div><div className="desc">{body}</div></div>
          <div className="btns">{plan === key ? <span className="chip2 ok">current plan</span> : target ? <button className="btn btn-ink btn-sm" disabled={busy !== null} onClick={() => go(target)}>{busy === target ? <span className="spinner" /> : null} Choose</button> : null}</div>
        </article>
      ))}
      <p className="hint"><Info /><span>Billing runs through Razorpay with UPI AutoPay or card mandates. Prices exclude 18% GST.</span></p>
    </div>
  );
}
