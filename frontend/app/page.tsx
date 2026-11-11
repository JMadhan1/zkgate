import NextLink from "next/link";
import { HeroVisual } from "@/components/HeroVisual";
import { Pipeline } from "@/components/Pipeline";
import { Arrow, Chakra, Cpu, Github, Info, Layers, Lock, Repeat, Server, Shield, Sparkle } from "@/components/icons";
import { REPO_URL } from "@/lib/site";

const MARQUEE = [
  "Groth16 over BN128",
  "5 Circom circuits",
  "In-browser proving",
  "~800-byte proofs",
  "Poseidon nullifiers",
  "Replay-proof by design",
  "Hash-chained audit log",
  "DPDP-ready age checks",
  "No Aadhaar number transmitted",
  "Python ⇄ snarkjs cross-checked",
];

const CLAIM_TYPES = [
  {
    code: "age_above_18 / 21 / 60",
    title: "Age threshold",
    learns: ["Threshold met (boolean)"],
    hidden: ["DOB", "Exact age", "Name", "Address", "Aadhaar no."],
  },
  {
    code: "india_citizen",
    title: "Valid Aadhaar holder",
    learns: ["A UIDAI-signed Aadhaar exists"],
    hidden: ["Everything else"],
    note: "Only 4 public signals",
  },
  {
    code: "state_resident / district_resident",
    title: "Residency",
    learns: ["State (or state + district), only if asked"],
    hidden: ["House", "Street", "Pincode", "DOB", "Name"],
  },
  {
    code: "compound_kyc",
    title: "Full KYC in one proof",
    learns: ["Valid Aadhaar", "Age ≥ N", "State"],
    hidden: ["DOB", "Exact age", "Full address", "Name"],
    note: "All bound to one person",
  },
  {
    code: "pan_holder",
    title: "PAN holder",
    learns: ["Holds a linked PAN", "Per-verifier pseudonym"],
    hidden: ["The PAN number itself"],
  },
];

const COMPARE = [
  { sys: "UIDAI New Aadhaar App", live: ["yes", "Yes, 40M+ downloads"], zk: ["mid", "Selective disclosure (reveals real value)"] },
  { sys: "Google Wallet Aadhaar VC", live: ["yes", "Yes"], zk: ["mid", "Selective disclosure (ISO 18013-5 mdoc)"] },
  { sys: "Anon Aadhaar (Ethereum Foundation)", live: ["mid", "Pre-production"], zk: ["zk", "True ZK (QR-based)"] },
  { sys: "Self Protocol (self.xyz)", live: ["yes", "Yes, funded"], zk: ["zk", "True ZK"] },
  { sys: "ZKGate India", live: ["mid", "Prototype"], zk: ["zk", "True ZK, offline eKYC XML channel"], us: true },
];

const REPO = [
  { path: "circuits/", title: "5 Circom circuits", body: "Groth16 over BN128: age, location, citizenship, compound KYC and PAN, each with its own trusted setup." },
  { path: "backend/", title: "FastAPI verifier", body: "Python Groth16 verifier, nullifier replay guard and a tamper-evident, hash-chained audit log." },
  { path: "sdk/", title: "JavaScript SDK", body: "Parses Aadhaar XML, derives the secret, builds the witness, then generates and submits proofs." },
  { path: "frontend/", title: "Citizen portal", body: "In-browser proof generation, so the XML never leaves the device. You're looking at it." },
  { path: "verifier-portal/", title: "Verifier portal", body: "Request a claim, verify a proof, reject replays." },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="grid-bg" aria-hidden />
        <div className="container hero-grid">
          <div>
            <span className="pill-badge reveal">
              <span className="flag" aria-hidden><i style={{ background: "#FF9933" }} /><i style={{ background: "#fff" }} /><i style={{ background: "#138808" }} /></span>
              <span><b>Sovereign Technology</b> for India</span>
            </span>
            <h1 className="reveal" style={{ ["--d" as string]: "80ms" }}>
              Prove a fact. <span className="serif tri-text">Not your identity.</span>
            </h1>
            <p className="lede reveal" style={{ ["--d" as string]: "160ms" }}>
              ZKGate is India&apos;s indigenous zero-knowledge identity layer. Prove you&apos;re over 18, a resident of
              your state, or a valid Aadhaar holder with a ~800-byte proof that reveals nothing else. No name, no date of
              birth, no address, no Aadhaar number.
            </p>
            <div className="hero-cta reveal" style={{ ["--d" as string]: "240ms" }}>
              <NextLink href="/prove" className="btn btn-primary">
                Generate a proof <Arrow className="arrow" />
              </NextLink>
              <a href="#how" className="btn">See how it works</a>
            </div>
            <div className="hero-meta reveal" style={{ ["--d" as string]: "320ms" }}>
              <div><b>~800 B</b><span>proof size</span></div>
              <div><b>0</b><span>personal fields sent</span></div>
              <div><b>5</b><span>circuits, real Groth16</span></div>
            </div>
          </div>
          <div className="reveal" style={{ ["--d" as string]: "200ms" }}>
            <HeroVisual />
          </div>
        </div>
      </section>

      <div className="marquee" aria-label="Key properties">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span className="marquee-item" key={i} aria-hidden={i >= MARQUEE.length}><i />{m}</span>
          ))}
        </div>
      </div>

      {/* ── Problem ──────────────────────────────────────────────────── */}
      <section className="section" id="problem">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow reveal">Why this exists</span>
            <h2 className="h-section reveal">
              India&apos;s identity system runs on <span className="serif">over-disclosure.</span>
            </h2>
            <p className="lede reveal">
              Proving one fact about yourself usually means handing over your entire identity. That design choice has a
              real cost today.
            </p>
          </div>
          <div className="stats">
            <article className="card spot stat reveal">
              <div className="stat-num saffron">₹22,495 Cr</div>
              <p>Lost to cyber fraud in India in 2025, much of it through &ldquo;digital arrest&rdquo; scams that rely on citizens believing that sharing Aadhaar or PAN is a normal verification step.</p>
              <cite>Source: 2025 cyber-fraud reporting, PIB alerts</cite>
            </article>
            <article className="card spot stat reveal" style={{ ["--d" as string]: "100ms" }}>
              <div className="stat-num chakra">7.9M+</div>
              <p>KYC records (Aadhaar, PAN, documents) leaked from a single compromised fintech vendor in January 2025. Aggregating full documents is a systemic risk.</p>
              <cite>Source: dark-web breach reporting, Jan 2025</cite>
            </article>
            <article className="card spot stat reveal" style={{ ["--d" as string]: "200ms" }}>
              <div className="stat-num green">13 May 2027</div>
              <p>DPDP Act deadline for gaming, social and e-commerce platforms to implement verifiable age and parental-consent checks without creating a new data liability.</p>
              <cite>Source: DPDP Rules, notified Nov 2025</cite>
            </article>
          </div>
        </div>
      </section>

      <div className="container"><div className="section-divider" /></div>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow reveal">How it works</span>
            <h2 className="h-section reveal">
              Real cryptography, <span className="serif">not a mock.</span>
            </h2>
            <p className="lede reveal">
              Every layer verifies genuine cryptography. The backend&apos;s Python Groth16 verifier is cross-checked against
              snarkjs, and the JS and Python encoders are proven byte-identical, so a proof built in the browser verifies on
              the server.
            </p>
          </div>
          <div className="reveal"><Pipeline /></div>

          <div className="bento" style={{ marginTop: 16 }}>
            <article className="card spot span-3 wide-m reveal">
              <div className="ico saffron"><Lock /></div>
              <h3>Constrain, don&apos;t report</h3>
              <p>Circuits assert <code className="code-chip">is_valid === 1</code> instead of outputting a flag, so a minor cannot generate an &ldquo;age ≥ 18&rdquo; proof at all. &ldquo;The proof verifies&rdquo; and &ldquo;the claim is true&rdquo; are the same statement.</p>
            </article>
            <article className="card spot span-3 reveal" style={{ ["--d" as string]: "80ms" }}>
              <div className="ico chakra"><Shield /></div>
              <h3>Two-gate verification</h3>
              <p>A cryptographically valid proof can still answer the wrong question. The backend checks the pairing <em>and</em> that the public signals match what the verifier actually asked.</p>
            </article>
            <article className="card spot span-2 reveal">
              <div className="ico green"><Repeat /></div>
              <h3>Replay-proof by design</h3>
              <p>A nullifier, <code className="code-chip">Poseidon(secret, verifier_id, expiry)</code>, blocks replay per verifier and makes cross-verifier tracking of a citizen impossible.</p>
            </article>
            <article className="card spot span-2 reveal" style={{ ["--d" as string]: "80ms" }}>
              <div className="ico saffron"><Cpu /></div>
              <h3>Proven on your device</h3>
              <p>The witness, the secret and the XML live only in your browser&apos;s memory. Only the proof crosses the network.</p>
            </article>
            <article className="card spot span-2 reveal" style={{ ["--d" as string]: "160ms" }}>
              <div className="ico chakra"><Layers /></div>
              <h3>One secret, many claims</h3>
              <p>Every claim is bound to the same private secret: provably about one person, without exposing who that person is.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Claims ───────────────────────────────────────────────────── */}
      <section className="section" id="claims" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow reveal">What can be proven</span>
            <h2 className="h-section reveal">
              Five claim types. <span className="serif">One private secret.</span>
            </h2>
            <p className="lede reveal">
              The selling point is how short the &ldquo;verifier learns&rdquo; list is.
            </p>
          </div>
          <div className="claims">
            {CLAIM_TYPES.map((c, i) => (
              <article className="card spot claim-card reveal" key={c.code} style={{ ["--d" as string]: `${(i % 3) * 80}ms` }}>
                <div>
                  <code>{c.code}</code>
                  <h3 style={{ marginTop: 10 }}>{c.title}</h3>
                </div>
                <div>
                  <div className="tag-label">Verifier learns</div>
                  <div className="tags">{c.learns.map((l) => <span className="tag learn" key={l}>{l}</span>)}</div>
                </div>
                <div>
                  <div className="tag-label">Stays private</div>
                  <div className="tags">{c.hidden.map((h) => <span className="tag hide" key={h}>{h}</span>)}</div>
                </div>
                {c.note && <div className="tag-label" style={{ margin: 0, color: "var(--saffron-ink)" }}>↳ {c.note}</div>}
              </article>
            ))}
            <NextLink href="/prove" className="card spot claim-card reveal" style={{ ["--d" as string]: "160ms", alignContent: "center", justifyItems: "start", borderStyle: "dashed" }}>
              <div className="ico saffron"><Sparkle /></div>
              <h3>Try one now</h3>
              <p style={{ margin: 0, color: "var(--muted)" }}>Generate a real proof in your browser with a synthetic test citizen. Nothing is uploaded.</p>
              <span className="btn btn-sm">Open the demo <Arrow className="arrow" /></span>
            </NextLink>
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────────── */}
      <section className="section" id="compare" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow reveal">Where this stands</span>
            <h2 className="h-section reveal">
              Selective disclosure <span className="serif">vs. true zero-knowledge.</span>
            </h2>
            <p className="lede reveal">
              Most &ldquo;privacy-preserving&rdquo; Aadhaar tools share fewer fields but still reveal the real value of
              whatever is shared. True zero-knowledge reveals only the boolean answer, never the value underneath. That
              is the gap this project targets.
            </p>
          </div>
          <div className="table-wrap reveal">
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr><th scope="col">System</th><th scope="col">Live today?</th><th scope="col">Disclosure model</th></tr>
                </thead>
                <tbody>
                  {COMPARE.map((r) => (
                    <tr key={r.sys} className={r.us ? "us" : undefined}>
                      <td>{r.sys}</td>
                      <td><span className={`status ${r.live[0]}`}>{r.live[1]}</span></td>
                      <td><span className={`status ${r.zk[0]}`}>{r.zk[1]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture ─────────────────────────────────────────────── */}
      <section className="section" id="architecture" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow reveal">Under the hood</span>
            <h2 className="h-section reveal">What&apos;s <span className="serif">in the box.</span></h2>
          </div>
          <div className="repo">
            {REPO.map((r, i) => (
              <a
                key={r.path}
                href={`${REPO_URL}/tree/main/${r.path}`}
                target="_blank"
                rel="noreferrer"
                className="card spot reveal"
                style={{ ["--d" as string]: `${i * 70}ms` }}
              >
                <span className="path">{r.path}</span>
                <h4>{r.title}</h4>
                <p>{r.body}</p>
              </a>
            ))}
          </div>
          <div className="bento" style={{ marginTop: 12 }}>
            <div className="card span-3 reveal" style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div className="ico green"><Cpu /></div>
              <div><b>Citizen&apos;s device</b><p style={{ marginTop: 2 }}>XML parsing, secret derivation, witness and Groth16 proving.</p></div>
            </div>
            <div className="card span-3 reveal" style={{ display: "flex", gap: 16, alignItems: "center", ["--d" as string]: "80ms" }}>
              <div className="ico chakra"><Server /></div>
              <div><b>Verifier&apos;s server</b><p style={{ marginTop: 2 }}>Pairing check, semantic gate, nullifier registry, audit chain.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta reveal">
            <Chakra className="chakra-wheel" />
            <h2>Sovereign <span className="serif">by design.</span></h2>
            <p className="lede">
              No dependency on a foreign wallet, no server that ever sees your Aadhaar XML, and no reason left to hand over
              more than a single true-or-false answer.
            </p>
            <div className="hero-cta">
              <NextLink href="/prove" className="btn btn-primary">Try the citizen demo <Arrow className="arrow" /></NextLink>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn"><Github /> Explore the repository</a>
            </div>
          </div>
          <div className="disclaimer reveal">
            <Info />
            <div>
              <b>Prototype status.</b> This is an active hackathon/research prototype, not a production system. The
              zero-knowledge layer is real, tested cryptography end to end. The trusted setup is currently single-party
              (not production-grade), and the issuer-credential model verifies a registered issuer&apos;s signature rather than
              UIDAI&apos;s signature directly. See{" "}
              <a href={`${REPO_URL}/blob/main/docs/UIDAI_INTEGRATION.md`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                docs/UIDAI_INTEGRATION.md
              </a>{" "}
              for the exact status.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
