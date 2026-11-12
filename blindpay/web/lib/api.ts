"use client";

// Same-origin API client. Session cookie is HttpOnly (JS never sees it); state
// changes carry the CSRF token the session endpoint hands out.

let csrf: string | null = null;

export type ApiError = { status: number; message: string };

export function setCsrf(token: string | null) {
  csrf = token;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      message = j?.error?.message ?? message;
    } catch {}
    throw { status: res.status, message } as ApiError;
  }
  return res.json() as Promise<T>;
}

export function inr(paise: number): string {
  const rupees = Math.floor(Math.abs(paise) / 100);
  const p = Math.abs(paise) % 100;
  const s = rupees.toLocaleString("en-IN");
  return `${paise < 0 ? "-" : ""}₹${s}${p ? "." + String(p).padStart(2, "0") : ""}`;
}

/** Read a bearer token from the URL fragment, then wipe it from the address bar and history. */
export function takeFragmentToken(): string | null {
  const m = window.location.hash.match(/^#(bp_[A-Za-z0-9_-]{20,80})$/);
  history.replaceState(null, "", window.location.pathname);
  return m ? m[1] : null;
}
