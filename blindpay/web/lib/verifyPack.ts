"use client";

// The CA's checks, run entirely in the browser. Mirrors blindpay/backend/app/proofs.py
// (log_hash, request_hash, spent_before) and the backend test `ca_verify`.

export type Approval = {
  request_id: string; member: string; member_tag: string; amount_paise: number; description: string;
  status: string; decided_at: string; decided_by: string | null;
  proof: null | { proof: unknown; public_signals: string[]; commitment_seq: number; spent_before_paise: number; period: number };
};
export type LogEntry = { seq: number; ts: string; member_tag: string; period: number; version: number; commitment: string; prev_hash: string; hash: string };
export type Pack = {
  format: string; company: { id: string; name: string; gstin: string | null }; period: number; generated_at: string;
  verification_key: unknown; policy_log: LogEntry[]; policy_log_head: string; approvals: Approval[];
};
export type Row = { a: Approval; ok: boolean; reason: string };
export type Report = { logIntact: boolean; logProblem: string | null; rows: Row[]; proved: number; unproved: number; failed: number };

const GENESIS = "0".repeat(64);

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

async function fieldFrom(text: string): Promise<string> {
  const d = (await sha256(text)).slice(0, 31);
  let n = 0n;
  for (const byte of d) n = (n << 8n) | BigInt(byte);
  return n.toString();
}

async function logHash(c: string, e: LogEntry, prev: string): Promise<string> {
  // Keys in sorted order, no spaces: identical to Python json.dumps(sort_keys=True, separators=(",", ":")).
  const blob = JSON.stringify({ c, k: e.commitment, m: e.member_tag, p: e.period, prev, s: e.seq, t: e.ts, v: e.version });
  return hex(await sha256(blob));
}

export async function verifyPack(pack: Pack): Promise<Report> {
  if (pack.format !== "blindpay.audit-pack/1") throw new Error("This isn't a BlindPay Audit Pack.");
  const snarkjs: any = await import("snarkjs");

  let prev = GENESIS;
  let logProblem: string | null = null;
  const bySeq = new Map<number, LogEntry>();
  for (const e of pack.policy_log) {
    const h = await logHash(pack.company.id, e, prev);
    if (!logProblem && (e.prev_hash !== prev || e.hash !== h)) logProblem = `entry ${e.seq} doesn't chain (edited or removed history)`;
    prev = e.hash;
    bySeq.set(e.seq, e);
  }
  if (!logProblem && prev !== pack.policy_log_head) logProblem = "log head doesn't match the last entry";

  const spent = new Map<string, number>();
  const rows: Row[] = [];
  const ordered = [...pack.approvals].sort((x, y) => x.decided_at.localeCompare(y.decided_at));
  for (const a of ordered) {
    if (!a.proof) {
      rows.push({ a, ok: false, reason: "No proof: decided by hand without a policy" });
      continue;
    }
    const entry = bySeq.get(a.proof.commitment_seq);
    const before = spent.get(a.member_tag) ?? 0;
    let reason = "";
    if (!entry) reason = "Commitment isn't in the policy log";
    else if (entry.ts > a.decided_at) reason = "Limit was committed after the decision";
    else if (entry.member_tag !== a.member_tag || entry.period !== pack.period) reason = "Commitment is for another member or month";
    else {
      const expected = [entry.commitment, a.member_tag, String(pack.period), String(a.amount_paise), String(before),
        await fieldFrom(`${a.request_id}|${a.member_tag}|${pack.period}|${a.amount_paise}`)];
      if (JSON.stringify(expected) !== JSON.stringify(a.proof.public_signals)) reason = "Proof doesn't match this amount, request or prior spend";
      else if (!(await snarkjs.groth16.verify(pack.verification_key, a.proof.public_signals, a.proof.proof))) reason = "Proof is invalid";
    }
    rows.push({ a, ok: !reason, reason: reason || `Within the committed limit (prior spend ₹${(before / 100).toLocaleString("en-IN")})` });
    spent.set(a.member_tag, before + a.amount_paise);
  }
  return {
    logIntact: !logProblem, logProblem, rows,
    proved: rows.filter((r) => r.ok).length,
    unproved: rows.filter((r) => !r.a.proof).length,
    failed: rows.filter((r) => r.a.proof && !r.ok).length,
  };
}
