'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, BookOpen, Terminal, Code2, Layers, ShieldCheck, Cpu, AlertTriangle, Info, ChevronRight, ExternalLink } from 'lucide-react';

/* ─── Syntax highlighting ────────────────────────────────────────── */
type TokenType = 'keyword' | 'string' | 'comment' | 'type' | 'number' | 'normal';

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#c792ea',
  string:  '#c3e88d',
  comment: '#546e7a',
  type:    '#ffcb6b',
  number:  '#f78c6c',
  normal:  'rgba(0,240,255,0.85)',
};

function highlight(code: string, lang: 'sol' | 'ts' | 'bash' = 'sol') {
  const kwSol = ['pragma','solidity','import','contract','interface','function','modifier','require','constructor','external','public','returns','mapping','event','emit','uint256','address','bool','bytes32','string','memory'];
  const kwTs  = ['import','from','const','let','async','await','new','return','function','interface','type','export','default','class'];
  const kws = lang === 'sol' ? kwSol : kwTs;

  return code.split('\n').map((line) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
      return [{ text: line, type: 'comment' as TokenType }];
    }
    const tokens: { text: string; type: TokenType }[] = [];
    let rest = line;
    while (rest.length > 0) {
      const kw = kws.find((k) => rest.startsWith(k) && (rest.length === k.length || /\W/.test(rest[k.length])));
      if (kw) { tokens.push({ text: kw, type: 'keyword' }); rest = rest.slice(kw.length); continue; }
      if (rest[0] === '"' || rest[0] === "'") {
        const q = rest[0];
        const end = rest.indexOf(q, 1);
        const s = end === -1 ? rest : rest.slice(0, end + 1);
        tokens.push({ text: s, type: 'string' }); rest = rest.slice(s.length); continue;
      }
      tokens.push({ text: rest[0], type: 'normal' }); rest = rest.slice(1);
    }
    return tokens;
  });
}

const CodeBlock = ({ code, lang = 'sol', title, showLines = true }: {
  code: string; lang?: 'sol' | 'ts' | 'bash'; title?: string; showLines?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const lines = highlight(code, lang);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="code-block" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', gap:4 }}>
            {['#ef4444','#f59e0b','#10b981'].map((c) => (
              <div key={c} style={{ width:9, height:9, borderRadius:'50%', background:c, opacity:0.7 }} />
            ))}
          </div>
          {title && <span style={{ fontSize:'11px', fontFamily:"'JetBrains Mono', monospace", color:'#475569', marginLeft:6 }}>{title}</span>}
          <span style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'1px 6px', fontSize:'9px', fontFamily:"'JetBrains Mono', monospace", color:'#334155', textTransform:'uppercase' }}>{lang}</span>
        </div>
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={copy}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin:0, padding:'16px 0', overflowX:'auto', fontSize:'12.5px', lineHeight:1.8, fontFamily:"'JetBrains Mono', monospace" }}>
        {lines.map((tokens, i) => (
          <div key={i} style={{ display:'flex', minHeight:'1.8em' }}>
            {showLines && <span style={{ minWidth:44, textAlign:'right', paddingRight:16, color:'#1e293b', userSelect:'none', fontSize:'11px', paddingTop:1 }}>{i + 1}</span>}
            <span style={{ paddingLeft: showLines ? 0 : 16 }}>
              {tokens.map((tok, j) => <span key={j} style={{ color: TOKEN_COLORS[tok.type] }}>{tok.text}</span>)}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
};

/* ─── Callout ───────────────────────────────────────────────────── */
const Callout = ({ type, children }: { type: 'info' | 'warning' | 'danger'; children: React.ReactNode }) => {
  const map = {
    info:    { cls: 'callout-info',    icon: <Info size={15} color="#00f0ff" />,          label: 'Info'    },
    warning: { cls: 'callout-warning', icon: <AlertTriangle size={15} color="#f59e0b" />, label: 'Warning' },
    danger:  { cls: 'callout-danger',  icon: <AlertTriangle size={15} color="#ef4444" />, label: 'Danger'  },
  };
  const { cls, icon, label } = map[type];
  return (
    <div className={cls} style={{ marginBottom:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontWeight:700, fontSize:'13px', color:'white' }}>{icon} {label}</div>
      <div style={{ fontSize:'13px', color:'#94a3b8', lineHeight:1.7 }}>{children}</div>
    </div>
  );
};

/* ─── Data ──────────────────────────────────────────────────────── */
const SECTIONS = [
  { id:'overview',    label:'Overview',          icon:<BookOpen size={14} /> },
  { id:'quickstart',  label:'Quick Start',        icon:<Terminal size={14} /> },
  { id:'contracts',   label:'Smart Contracts',    icon:<Code2 size={14} /> },
  { id:'integration', label:'Integration Guide',  icon:<Layers size={14} /> },
  { id:'circuits',    label:'ZK Circuits',         icon:<Cpu size={14} /> },
  { id:'api',         label:'API Reference',       icon:<Terminal size={14} /> },
  { id:'security',    label:'Security',            icon:<ShieldCheck size={14} /> },
];

const SOLIDITY_FULL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 1. Import the interface
import {IZKGate} from "@zkgate/contracts/interfaces/IZKGate.sol";

contract YourProtocol {
    // 2. Initialize in constructor
    IZKGate public zkGate = IZKGate(ZKGATE_ADDRESS);

    // 3. Add the modifier
    modifier onlyVerified() {
        require(
            zkGate.hasAccess(msg.sender, 3),
            "KYC required"
        );
        _;
    }

    // 4. Use it
    function deposit() external onlyVerified {
        // Your logic here — only KYC'd users can call this
    }
}`;

const TS_SDK = `import { ZKGateClient } from '@zkgate/sdk';

const client = new ZKGateClient({
  network: 'hashkey-testnet',
  issuerAddress: '0x...',
});

// Issue a credential (server-side)
const credential = await client.issueCredential({
  subject: userAddress,
  claims: { kyc: true, age: 25, jurisdiction: 'SG' },
  credentialType: 3 // KYC_COMPLETE
});

// Generate proof (client-side, private)
const proof = await client.generateProof({
  credential,
  claim: 'KYC_COMPLETE',
});

// Submit to chain
const tx = await client.submitProof(proof);`;

const ADDRESSES = [
  { name: 'ZKGate',               addr: '0x1234...5678' },
  { name: 'ZKCredentialRegistry', addr: '0xabcd...ef01' },
  { name: 'ZKVerifier',           addr: '0x9876...5432' },
];

/* ─── Page ──────────────────────────────────────────────────────── */
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); }); },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach(({ id }) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, position:'relative', zIndex:1 }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px 80px', display:'grid', gap:'3rem' }}
        className="docs-grid">

        {/* SIDEBAR */}
        <aside style={{ position:'sticky', top:100, height:'fit-content', display:'flex', flexDirection:'column', gap:'1.5rem', paddingTop:'2rem' }}
          className="docs-sidebar">
          <div style={{ fontSize:'10px', fontFamily:"'JetBrains Mono', monospace", color:'#334155', textTransform:'uppercase', letterSpacing:'0.18em', fontWeight:700, paddingLeft:16 }}>
            Documentation
          </div>
          <nav style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {SECTIONS.map(({ id, label, icon }) => (
              <button key={id} onClick={() => scrollTo(id)} className={`docs-nav-item ${activeSection === id ? 'active' : ''}`}>
                <span style={{ opacity:0.7 }}>{icon}</span>{label}
              </button>
            ))}
          </nav>
          <div style={{ background:'linear-gradient(135deg,rgba(0,240,255,0.06),rgba(139,92,246,0.06))', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'1.25rem', marginTop:'0.5rem' }}>
            <ShieldCheck size={20} color="#00f0ff" style={{ marginBottom:8 }} />
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.8rem', color:'white', marginBottom:6 }}>Need a sandbox?</div>
            <p style={{ fontSize:'11px', color:'#64748b', marginBottom:10, lineHeight:1.6 }}>Get testnet HSK and sample credentials from our Discord.</p>
            <a href="#" style={{ fontSize:'11px', fontWeight:700, color:'#00f0ff', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
              Join Community <ChevronRight size={12} />
            </a>
          </div>
        </aside>

        {/* CONTENT */}
        <div style={{ paddingTop:'2rem', display:'flex', flexDirection:'column', gap:'5rem' }}>

          {/* OVERVIEW */}
          <section id="overview">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
                <BookOpen size={14} color="#00f0ff" />
                <span style={{ fontSize:'11px', fontFamily:"'JetBrains Mono', monospace", color:'#00f0ff', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em' }}>Documentation</span>
              </div>
              <h1 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'clamp(2rem,5vw,3rem)', letterSpacing:'-0.04em', color:'white', marginBottom:'1rem', lineHeight:1.1 }}>
                Technical{' '}
                <span style={{ background:'linear-gradient(135deg,#00f0ff,#8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                  Integration
                </span>
              </h1>
              <p style={{ color:'#64748b', fontSize:'1.1rem', lineHeight:1.8, maxWidth:620, marginBottom:'2rem' }}>
                ZKGate is designed for developer velocity. Add privacy-preserving compliance layers to your HashKey Chain dApps in minutes, not days.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem' }}>
                {[
                  { icon:<Terminal size={18} />, title:'SDK Client',         desc:'Local proof generation', color:'#8b5cf6' },
                  { icon:<Code2 size={18} />,    title:'On-Chain Interface', desc:'Gas-optimized calls',    color:'#00f0ff' },
                  { icon:<Layers size={18} />,   title:'Multi-Issuer',       desc:'Aggregated identity',    color:'#f050f0' },
                ].map(({ icon, title, desc, color }) => (
                  <div key={title} className="glass-card" style={{ padding:'1.25rem' }}>
                    <div style={{ color, marginBottom:10 }}>{icon}</div>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.875rem', color:'white', marginBottom:4 }}>{title}</div>
                    <div style={{ fontSize:'12px', color:'#64748b' }}>{desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* QUICK START */}
          <section id="quickstart">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.75rem', color:'white', letterSpacing:'-0.03em', marginBottom:'1rem' }}>Quick Start</h2>
              <p style={{ color:'#64748b', marginBottom:'1.5rem', lineHeight:1.7 }}>Get ZKGate running in your project in under 5 minutes.</p>
              <Callout type="info">Make sure you&apos;re connected to HashKey Chain testnet (Chain ID: 133) before interacting with the contracts.</Callout>
              <CodeBlock lang="bash" title="terminal" showLines={false}
                code={`# Install the ZKGate SDK\nnpm install @zkgate/sdk @zkgate/contracts\n\n# Or with yarn\nyarn add @zkgate/sdk @zkgate/contracts`} />
              <CodeBlock lang="ts" title="zkgate.ts" code={TS_SDK} />
            </motion.div>
          </section>

          {/* SMART CONTRACTS */}
          <section id="contracts">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.75rem', color:'white', letterSpacing:'-0.03em', marginBottom:'0.5rem' }}>Smart Contracts</h2>
              <p style={{ color:'#64748b', marginBottom:'1.5rem', lineHeight:1.7 }}>
                Call <code style={{ background:'rgba(0,240,255,0.08)', color:'#00f0ff', padding:'2px 8px', borderRadius:5, fontFamily:"'JetBrains Mono',monospace", fontSize:'13px' }}>hasAccess()</code> to check compliance. ZKGate handles everything else.
              </p>
              <CodeBlock lang="sol" title="YourProtocol.sol" code={SOLIDITY_FULL} />
              <div style={{ marginTop:'2rem' }}>
                <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.9rem', color:'white', marginBottom:'1rem' }}>Testnet Contract Addresses</div>
                <div className="glass-card" style={{ overflow:'hidden' }}>
                  {ADDRESSES.map(({ name, addr }, i) => (
                    <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderBottom: i < ADDRESSES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:600, color:'white', fontFamily:"'Space Grotesk',sans-serif", marginBottom:2 }}>{name}</div>
                        <div style={{ fontSize:'11px', fontFamily:"'JetBrains Mono',monospace", color:'#475569' }}>{addr}</div>
                      </div>
                      <button className={`copy-btn ${copiedAddr === addr ? 'copied' : ''}`} onClick={() => copyAddr(addr)}>
                        {copiedAddr === addr ? <Check size={10} /> : <Copy size={10} />}
                        {copiedAddr === addr ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>

          {/* INTEGRATION */}
          <section id="integration">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.75rem', color:'white', letterSpacing:'-0.03em', marginBottom:'0.5rem' }}>Integration Guide</h2>
              <p style={{ color:'#64748b', marginBottom:'1.5rem', lineHeight:1.7 }}>The ZKGate SDK generates proofs locally in the user&apos;s browser — private data never leaves the device.</p>
              <Callout type="warning">Always verify proofs on-chain. Never rely solely on client-side proof generation for security decisions.</Callout>
              <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', marginTop:'1.5rem' }}>
                {[
                  { n:'01', title:'Issue Credential',  desc:'User completes KYC with an authorized issuer. A cryptographic commitment is created and stored in the Merkle tree.' },
                  { n:'02', title:'Generate Proof',    desc:'Client-side proof generation using the ZKGate SDK. The proof proves a claim without revealing the underlying data.' },
                  { n:'03', title:'Submit On-Chain',   desc:'The proof is submitted to the ZKGate verifier contract. A nullifier prevents replay attacks.' },
                  { n:'04', title:'Check Access',      desc:'Your protocol calls hasAccess(user, credentialType) to check if the user has a valid, unexpired proof.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} style={{ display:'flex', gap:'1.25rem', alignItems:'flex-start' }}>
                    <div style={{ minWidth:36, height:36, borderRadius:10, background:'rgba(0,240,255,0.08)', border:'1px solid rgba(0,240,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:'11px', color:'#00f0ff', fontWeight:700 }}>{n}</div>
                    <div>
                      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.9rem', color:'white', marginBottom:4 }}>{title}</div>
                      <div style={{ fontSize:'13px', color:'#64748b', lineHeight:1.7 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* ZK CIRCUITS */}
          <section id="circuits">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.75rem', color:'white', letterSpacing:'-0.03em', marginBottom:'0.5rem' }}>ZK Circuits</h2>
              <p style={{ color:'#64748b', marginBottom:'1.5rem', lineHeight:1.7 }}>ZKGate uses Groth16 proofs on the BN254 curve, compiled using Circom 2.0. Proving time averages under 2 seconds in modern browsers.</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
                {[
                  { label:'Proof System',    val:'Groth16'    },
                  { label:'Curve',           val:'BN254'      },
                  { label:'Language',        val:'Circom 2.0' },
                  { label:'Avg Proof Time',  val:'< 2s'       },
                ].map(({ label, val }) => (
                  <div key={label} className="glass-card" style={{ padding:'1.25rem' }}>
                    <div style={{ fontSize:'10px', fontFamily:"'JetBrains Mono',monospace", color:'#334155', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>{label}</div>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.1rem', color:'#00f0ff' }}>{val}</div>
                  </div>
                ))}
              </div>
              <Callout type="info">ZKGate uses mock proofs for the hackathon demo. Production deployment will integrate actual Groth16 verification using snarkjs and on-chain verifier contracts.</Callout>
            </motion.div>
          </section>

          {/* API REFERENCE */}
          <section id="api">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.75rem', color:'white', letterSpacing:'-0.03em', marginBottom:'0.5rem' }}>API Reference</h2>
              <p style={{ color:'#64748b', marginBottom:'1.5rem', lineHeight:1.7 }}>Simple REST API for credential issuance and proof generation. Integrated into the Next.js app.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {[
                  { method:'POST', path:'/api/issue-credential',  desc:'Issue a new ZK credential for a subject'     },
                  { method:'POST', path:'/api/generate-proof',    desc:'Generate a ZK proof for a credential claim'  },
                  { method:'GET',  path:'/api/merkle-root',       desc:'Get the current Merkle root of the registry' },
                  { method:'GET',  path:'/api/verify/:nullifier', desc:'Check if a nullifier has been used'          },
                ].map(({ method, path, desc }) => (
                  <div key={path} className="glass-card" style={{ padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
                    <span style={{ padding:'3px 10px', borderRadius:6, fontSize:'11px', fontFamily:"'JetBrains Mono',monospace", fontWeight:700, background: method==='POST' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.1)', color: method==='POST' ? '#8b5cf6' : '#10b981', border:`1px solid ${method==='POST' ? 'rgba(139,92,246,0.25)' : 'rgba(16,185,129,0.2)'}`, flexShrink:0 }}>{method}</span>
                    <code style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'12px', color:'#00f0ff', flex:1 }}>{path}</code>
                    <span style={{ fontSize:'12px', color:'#64748b' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* SECURITY */}
          <section id="security">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'1.75rem', color:'white', letterSpacing:'-0.03em', marginBottom:'0.5rem' }}>Security</h2>
              <p style={{ color:'#64748b', marginBottom:'1.5rem', lineHeight:1.7 }}>ZKGate is built with security-first principles. Key protections in place:</p>
              <Callout type="danger">This is a hackathon prototype. Do not use in production without a full security audit. ZK circuits use mock proofs.</Callout>
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {[
                  { title:'Nullifier System',  desc:'Each proof includes a unique nullifier. Nullifiers are stored on-chain to prevent replay attacks.' },
                  { title:'Merkle Proofs',      desc:'Credentials are stored as Merkle leaves. Proving membership proves issuance without revealing credential data.' },
                  { title:'Expiry System',       desc:'All credentials have a built-in expiry (default 365 days). Expired credentials cannot be used for verification.' },
                  { title:'Trusted Issuers',     desc:'Only authorized issuers can add Merkle roots to the registry, managed by ZKGate governance.' },
                ].map(({ title, desc }) => (
                  <div key={title} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderLeft:'3px solid rgba(0,240,255,0.4)', borderRadius:'0 12px 12px 0', padding:'1rem 1.25rem' }}>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:'0.875rem', color:'white', marginBottom:6 }}>{title}</div>
                    <div style={{ fontSize:'13px', color:'#64748b', lineHeight:1.7 }}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:'3rem', textAlign:'center', padding:'3rem 0', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                <p style={{ color:'#64748b', marginBottom:'1.5rem' }}>Ready to integrate ZKGate into your protocol?</p>
                <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
                  <button onClick={() => window.location.href='/issue'} className="btn-primary" style={{ padding:'12px 28px' }}>Try the Demo</button>
                  <a href="https://github.com/JMadhan1/zkgate" target="_blank" rel="noopener noreferrer">
                    <button className="btn-secondary" style={{ padding:'12px 24px', display:'flex', alignItems:'center', gap:8 }}>
                      <ExternalLink size={14} /> GitHub
                    </button>
                  </a>
                </div>
              </div>
            </motion.div>
          </section>

        </div>
      </div>

      <style jsx global>{`
        .docs-grid {
          grid-template-columns: 220px 1fr;
        }
        .docs-sidebar {
          display: flex;
        }
        @media (max-width: 1024px) {
          .docs-grid { grid-template-columns: 1fr; }
          .docs-sidebar { display: none; }
        }
      `}</style>
    </div>
  );
}
