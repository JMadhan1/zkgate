import NextLink from "next/link";
import { Hero } from "@/components/Hero";
import { IdCompare } from "@/components/IdCompare";
import { Story } from "@/components/Story";
import { Arrow, ArrowUpRight, Chakra, Github, Info, Lock, Repeat, Shield } from "@/components/icons";
import { REPO_URL } from "@/lib/site";

const TAPE = [
  "Prove the fact",
  "Keep the person",
  "Groth16 on your device",
  "~800-byte proofs",
  "Replay-proof",
  "DPDP-ready age checks",
  "No Aadhaar number sent",
];
const TAPE_BACK = ["Zero personal data", "Sovereign by design", "Built for India", "Open source", "Real cryptography"];

const CLAIMS = [
  { code: "age_above_18 · 21 · 60", title: "Age threshold", yes: ["Threshold met"], no: ["DOB", "Exact age", "Name", "Address", "Aadhaar no."] },
  { code: "india_citizen", title: "Valid Aadhaar holder", yes: ["A UIDAI-signed Aadhaar exists"], no: ["Everything else"] },
  { code: "state_resident · district_resident", title: "Residency", yes: ["State (or district), if asked"], no: ["House", "Street", "PIN", "DOB", "Name"] },
  { code: "compound_kyc", title: "Full KYC, one proof", yes: ["Valid Aadhaar", "Age ≥ N", "State"], no: ["DOB", "Exact age", "Address", "Name"] },
  { code: "pan_holder", title: "PAN holder", yes: ["Linked PAN", "Per-verifier pseudonym"], no: ["The PAN itself"] },
];

const COMPARE = [
  { sys: "UIDAI New Aadhaar App", live: ["y", "Yes, 40M+ downloads"], model: ["m", "Selective disclosure (reveals the real value)"] },
  { sys: "Google Wallet Aadhaar VC", live: ["y", "Yes"], model: ["m", "Selective disclosure (ISO 18013-5 mdoc)"] },
  { sys: "Anon Aadhaar (Ethereum Foundation)", live: ["m", "Pre-production"], model: ["zk", "True ZK (QR-based)"] },
  { sys: "Self Protocol (self.xyz)", live: ["y", "Yes, funded"], model: ["zk", "True ZK"] },
  { sys: "ZKGate India", live: ["m", "Prototype"], model: ["zk", "True ZK, offline eKYC XML channel"], us: true },
];

const REPO = [
  { path: "circuits/", title: "5 Circom circuits", body: "Groth16 over BN128: age, location, citizenship, compound KYC, PAN." },
  { path: "backend/", title: "FastAPI verifier", body: "Python Groth16 verifier, replay guard and hash-chained audit log." },
  { path: "sdk/", title: "JavaScript SDK", body: "Parse XML, derive the secret, build the witness, prove." },
  { path: "frontend/", title: "This site", body: "In-browser proving. The XML never leaves the device." },
  { path: "verifier-portal/", title: "Verifier portal", body: "Request a claim, verify a proof, reject replays." },
];

export default function Home() {
  return (
    <>
      <Hero />

      <div className="tape-zone" aria-hidden>
        <div className="tape back"><div className="tape-track">{[...TAPE_BACK, ...TAPE_BACK, ...TAPE_BACK].map((t, i) => <span className="tape-item" key={i}>{t}</span>)}</div></div>
        <div className="tape"><div className="tape-track">{[...TAPE, ...TAPE].map((t, i) => <span className="tape-item" key={i}>{t}</span>)}</div></div>
      </div>

      {/* ── 01 Problem ─────────────────────────────────────────────── */}
      <section className="section" id="problem" style={{ paddingTop: "clamp(50px, 7vw, 90px)" }}>
        <div className="container">
          <div className="section-head">
            <span className="kicker reveal"><span className="num">01</span> Why this exists</span>
            <h2 className="h-section reveal">India runs on <span className="serif mark">over&#8209;disclosure.</span></h2>
            <p className="lede reveal">
              Proving one fact about yourself usually means handing over your entire identity, as a photocopy, to
              every bank, app and SIM shop that asks. That has a real cost.
            </p>
          </div>
          <div className="stats">
            <article className="stat reveal">
              <span className="idx">Cyber fraud · 2025</span>
              <div className="big s">₹22,495 Cr</div>
              <p>Lost to cyber fraud in India in 2025, much of it through &ldquo;digital arrest&rdquo; scams built on the belief that sharing Aadhaar or PAN is normal.</p>
              <cite>Source: 2025 cyber-fraud reporting, PIB alerts</cite>
            </article>
            <article className="stat reveal" style={{ ["--d" as string]: "90ms" }}>
              <span className="idx">One vendor breach</span>
              <div className="big">7.9M+</div>
              <p>KYC records (Aadhaar, PAN, documents) leaked from a single compromised fintech vendor in January 2025.</p>
              <cite>Source: dark-web breach reporting, Jan 2025</cite>
            </article>
            <article className="stat reveal" style={{ ["--d" as string]: "180ms" }}>
              <span className="idx">DPDP deadline</span>
              <div className="big g">13.05.27</div>
              <p>Platforms must run verifiable age and parental-consent checks without creating a new data liability.</p>
              <cite>Source: DPDP Rules, notified Nov 2025</cite>
            </article>
          </div>
        </div>
      </section>

      {/* ── 02 The difference ──────────────────────────────────────── */}
      <section className="section" id="difference" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="kicker reveal"><span className="num">02</span> The difference</span>
            <h2 className="h-section reveal">Same check. <span className="serif">Nothing</span> handed over.</h2>
            <p className="lede reveal">Flip the card. That&apos;s the whole idea.</p>
          </div>
          <div className="reveal"><IdCompare /></div>
        </div>
      </section>

      {/* ── 03 How it works ────────────────────────────────────────── */}
      <section className="section" id="how" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="kicker reveal"><span className="num">03</span> How it works</span>
            <h2 className="h-section reveal">Real cryptography, <span className="serif">not a mock.</span></h2>
            <p className="lede reveal">
              The backend&apos;s Python Groth16 verifier is cross-checked against snarkjs, and the JS and Python encoders
              are byte-identical, so a proof built in your browser verifies on the server.
            </p>
          </div>
          <Story />
          <div className="principles">
            <article className="principle reveal">
              <div className="ic"><Lock /></div>
              <h4>Constrain, don&apos;t report</h4>
              <p>Circuits assert <code>is_valid === 1</code>. &ldquo;The proof verifies&rdquo; and &ldquo;the claim is true&rdquo; are the same statement.</p>
            </article>
            <article className="principle reveal" style={{ ["--d" as string]: "90ms" }}>
              <div className="ic"><Shield /></div>
              <h4>Two-gate verification</h4>
              <p>A valid proof can still answer the wrong question. The server checks both the maths and what was asked.</p>
            </article>
            <article className="principle reveal" style={{ ["--d" as string]: "180ms" }}>
              <div className="ic"><Repeat /></div>
              <h4>Replay-proof, unlinkable</h4>
              <p>Each verifier sees a different nullifier, so a proof can&apos;t be reused and you can&apos;t be tracked across services.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── 04 Claims ──────────────────────────────────────────────── */}
      <section className="section" id="claims" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="kicker reveal"><span className="num">04</span> What you can prove</span>
            <h2 className="h-section reveal">Five claims. <span className="serif">One secret.</span></h2>
            <p className="lede reveal">Every claim is bound to the same private secret: provably about one person, without saying who.</p>
          </div>
          <div className="rows">
            {CLAIMS.map((c, i) => (
              <div className="row reveal" key={c.code}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{c.title}</h3>
                  <code>{c.code}</code>
                </div>
                <div>
                  <div className="lbl">Verifier learns</div>
                  <div className="pills">{c.yes.map((y) => <span className="pill yes" key={y}>{y}</span>)}</div>
                </div>
                <div>
                  <div className="lbl">Stays with you</div>
                  <div className="pills">{c.no.map((n) => <span className="pill no" key={n}>{n}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="cta-row reveal" style={{ marginTop: 36 }}>
            <NextLink href="/prove" className="btn btn-ink">Try it with a test citizen <Arrow className="arrow" /></NextLink>
          </div>
        </div>
      </section>

      {/* ── 05 Landscape ───────────────────────────────────────────── */}
      <section className="section" id="compare" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="kicker reveal"><span className="num">05</span> Where this stands</span>
            <h2 className="h-section reveal">Fewer fields <span className="serif">isn&apos;t</span> zero-knowledge.</h2>
            <p className="lede reveal">
              Selective disclosure still reveals the real value of whatever it shares. True ZK reveals only the yes/no
              answer, never the value underneath.
            </p>
          </div>
          <div className="matrix reveal">
            <div className="matrix-scroll">
              <table>
                <thead><tr><th scope="col">System</th><th scope="col">Live today?</th><th scope="col">Disclosure model</th></tr></thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.sys} className={r.us ? "us" : undefined}>
                      <td>{r.sys}</td>
                      <td><span className={`dot ${r.live[0]}`}>{r.live[1]}</span></td>
                      <td><span className={`dot ${r.model[0]}`}>{r.model[1]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── 06 Architecture ────────────────────────────────────────── */}
      <section className="section" id="architecture" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="kicker reveal"><span className="num">06</span> Open source</span>
            <h2 className="h-section reveal">What&apos;s <span className="serif">in the box.</span></h2>
            <p className="lede reveal">Every layer is in one repository, MIT-licensed, with tests that verify real proofs.</p>
          </div>
          <div className="tiles">
            {REPO.map((r, i) => (
              <a key={r.path} href={`${REPO_URL}/tree/main/${r.path}`} target="_blank" rel="noreferrer" className="tile reveal" style={{ ["--d" as string]: `${i * 60}ms` }}>
                <ArrowUpRight className="go" />
                <span className="path">{r.path}</span>
                <h4>{r.title}</h4>
                <p>{r.body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="container-wide" style={{ paddingBottom: 30 }}>
        <div className="stage final reveal">
          <Chakra className="wheel" />
          <h2>Sovereign <span className="serif">by design.</span></h2>
          <p className="lede">
            No foreign wallet, no server that ever sees your Aadhaar XML, and no reason left to hand over more than a
            single true-or-false answer.
          </p>
          <div className="cta-row">
            <NextLink href="/prove" className="btn btn-saffron">Generate a proof <Arrow className="arrow" /></NextLink>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn btn-ghost-light"><Github /> View on GitHub</a>
          </div>
        </div>
        <div className="container">
          <div className="note reveal">
            <Info />
            <div>
              <b>Prototype status.</b> This is a research prototype, not a production system. The zero-knowledge layer is
              real, tested cryptography. The trusted setup is single-party, and the issuer model verifies a registered
              issuer&apos;s signature rather than UIDAI&apos;s directly. See{" "}
              <a href={`${REPO_URL}/blob/main/docs/UIDAI_INTEGRATION.md`} target="_blank" rel="noreferrer">UIDAI integration</a> for details.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
