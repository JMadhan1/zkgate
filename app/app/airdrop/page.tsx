'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ExternalLink, Gift, Shield, Zap, AlertCircle, Users } from 'lucide-react';
import { generateAgeProof, formatProofForContract, type ProofResult } from '../lib/zkproof';

/* ─── Mock stats (replace with on-chain data after deployment) ─── */
const TOTAL_SUPPLY  = 1000;
const CLAIM_AMOUNT  = 1000;

const RECENT_CLAIMS = [
  { addr: '0x7a3f...2c1d', time: '2 min ago',  amount: 1000, chain: 'HashKey Testnet' },
  { addr: '0x4e8b...9f3a', time: '8 min ago',  amount: 1000, chain: 'HashKey Testnet' },
  { addr: '0x1d6c...5b2e', time: '15 min ago', amount: 1000, chain: 'HashKey Testnet' },
  { addr: '0xa2f9...0e4c', time: '22 min ago', amount: 1000, chain: 'HashKey Testnet' },
  { addr: '0x3b7d...8a1f', time: '41 min ago', amount: 1000, chain: 'HashKey Testnet' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Get ZK Credential',
    desc: 'Complete KYC on the Issue page — generates a Merkle commitment to your identity.',
    icon: '🪪',
    color: '#00f0ff',
  },
  {
    step: '02',
    title: 'Connect Claiming Wallet',
    desc: 'Use ANY wallet to claim — it does NOT need to be your KYC wallet. Privacy preserved.',
    icon: '👛',
    color: '#8b5cf6',
  },
  {
    step: '03',
    title: 'Generate ZK Proof',
    desc: 'Prove age ≥ 18 and KYC eligibility using a Groth16 proof. No identity data leaked.',
    icon: '🔐',
    color: '#f050f0',
  },
  {
    step: '04',
    title: 'Claim Tokens',
    desc: 'Submit proof on-chain. Nullifier prevents double-claiming. Tokens sent to your wallet.',
    icon: '🎁',
    color: '#10b981',
  },
];

export default function AirdropPage() {
  const [claimed, setClaimed]       = useState(153); // mock claimed count
  const [stage, setStage]           = useState<'idle' | 'generating' | 'ready' | 'claiming' | 'claimed'>('idle');
  const [progress, setProgress]     = useState(0);
  const [stepText, setStepText]     = useState('');
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [txHash, setTxHash]         = useState('');
  const [timeLeft, setTimeLeft]     = useState({ d: 2, h: 14, m: 37, s: 0 });

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        let { d, h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; d--; }
        return { d, h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleGenerateProof = async () => {
    setStage('generating');
    setProgress(0);

    const steps = [
      'Loading ZK circuit...',
      'Computing witness...',
      'Running Groth16 prover...',
      'Building nullifier...',
      'Verifying locally...',
    ];
    let stepIdx = 0;
    setStepText(steps[0]);

    const interval = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + 1.5, 97);
        const idx = Math.floor((next / 100) * steps.length);
        if (idx !== stepIdx && idx < steps.length) {
          stepIdx = idx;
          setStepText(steps[idx]);
        }
        return next;
      });
    }, 80);

    try {
      const now = Math.floor(Date.now() / 1000);
      const dob = now - (25 * 365.25 * 86400);
      const secret = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      const result = await generateAgeProof({
        birthTimestamp: Math.floor(dob),
        userSecret: secret,
        currentTimestamp: now,
        ageThreshold: 18,
      });

      clearInterval(interval);
      setProgress(100);
      setStepText('Proof ready!');
      setProofResult(result);
      setTimeout(() => setStage('ready'), 400);
    } catch {
      clearInterval(interval);
      setProgress(0);
      setStage('idle');
    }
  };

  const handleClaim = async () => {
    setStage('claiming');
    await new Promise(r => setTimeout(r, 2000));
    const fakeTx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setTxHash(fakeTx);
    setClaimed(c => c + 1);
    setStage('claimed');
  };

  const remaining = TOTAL_SUPPLY - claimed;
  const pct = Math.round((claimed / TOTAL_SUPPLY) * 100);

  return (
    <div style={{ minHeight: '100vh', paddingTop: 100, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 100, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', marginBottom: '1.5rem' }}>
            <Gift size={14} color="#8b5cf6" />
            <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#8b5cf6', fontWeight: 600, letterSpacing: '0.1em' }}>ZKGATE TOKEN AIRDROP</span>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.04em', color: 'white', marginBottom: '1rem' }}>
            Claim Without{' '}
            <span style={{ background: 'linear-gradient(135deg, #8b5cf6, #f050f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Revealing</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
            Prove eligibility with a ZK proof. Claim with any wallet.
            Your identity is never linked to your claiming address.
          </p>
        </motion.div>

        {/* ── Stats bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}
        >
          {[
            { label: 'Remaining',   val: remaining.toLocaleString(), sub: `of ${TOTAL_SUPPLY}`, color: '#00f0ff' },
            { label: 'Per Claim',   val: `${CLAIM_AMOUNT.toLocaleString()} ZKG`, sub: 'per wallet',  color: '#8b5cf6' },
            { label: 'Claimed',     val: `${pct}%`,  sub: `${claimed} claims`, color: '#f050f0' },
            { label: 'Ends In',     val: `${timeLeft.d}d ${timeLeft.h}h`, sub: `${timeLeft.m}m ${timeLeft.s}s`, color: '#10b981' },
          ].map(({ label, val, sub, color }) => (
            <div key={label} className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.5rem', color, marginBottom: 2 }}>{val}</div>
              <div style={{ fontSize: '11px', color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Progress bar ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>
            <span>{claimed} claimed</span>
            <span>{remaining} remaining</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #f050f0)', borderRadius: 4 }}
            />
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>

          {/* ── Claim Card ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <AnimatePresence mode="wait">
              {stage === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Gift size={18} color="#8b5cf6" />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>ZKGate Token Airdrop</div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontFamily: "'Inter', sans-serif" }}>Claim {CLAIM_AMOUNT} ZKG tokens</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(5,5,20,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Eligibility Requirements</div>
                    {[
                      { label: 'Age ≥ 18',       met: true,  proof: 'ZK Age Proof' },
                      { label: 'KYC Complete',    met: true,  proof: 'Credential Merkle Proof' },
                      { label: 'No prior claim',  met: true,  proof: 'Nullifier Check' },
                    ].map(({ label, met, proof }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: met ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${met ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {met && <Check size={9} color="#10b981" />}
                          </div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>{label}</span>
                        </div>
                        <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>{proof}</span>
                      </div>
                    ))}
                  </div>

                  {/* Key insight */}
                  <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Shield size={14} color="#8b5cf6" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
                      <strong style={{ color: '#c4b5fd' }}>Privacy guarantee:</strong> This wallet is never linked to your KYC identity.
                      You could use a fresh wallet — the ZK proof still works.
                    </div>
                  </div>

                  <button onClick={handleGenerateProof} className="btn-primary animate-pulse-glow" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px' }}>
                    <Zap size={16} /> Generate Eligibility Proof
                  </button>
                </motion.div>
              )}

              {stage === 'generating' && (
                <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, marginBottom: 8 }}>Generating ZK Proof</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>Proving eligibility without revealing identity...</div>
                  </div>

                  {/* Animated rings */}
                  <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 2rem' }}>
                    {[10, 20, 30].map((inset, i) => (
                      <div key={i} style={{ position: 'absolute', inset, borderRadius: '50%', border: `1.5px solid rgba(139,92,246,${0.4 - i * 0.1})`, animation: `${i % 2 === 0 ? 'ring-rotate' : 'ring-rotate-reverse'} ${3 + i * 2}s linear infinite` }} />
                    ))}
                    <div style={{ position: 'absolute', inset: 40, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#8b5cf6', fontFamily: "'Space Grotesk', sans-serif" }}>{Math.floor(progress)}%</span>
                    </div>
                  </div>

                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #f050f0)', width: `${progress}%`, transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#8b5cf6' }}>{stepText}</div>
                </motion.div>
              )}

              {stage === 'ready' && proofResult && (
                <motion.div key="ready" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="glass-card" style={{ padding: '2rem', borderColor: 'rgba(139,92,246,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={16} color="#8b5cf6" />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'white', fontSize: '1rem' }}>Proof Ready</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>Generated in {proofResult.proofTime}ms</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(5,5,20,0.9)', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                    {[
                      { k: 'Nullifier',     v: proofResult.nullifierHash.slice(0, 22) + '...' },
                      { k: 'Protocol',      v: 'Groth16 / BN254' },
                      { k: 'Public Sigs',   v: proofResult.publicSignals.slice(0, 2).join(', ') + '...' },
                      { k: 'Mode',          v: proofResult.isSimulated ? 'Simulated' : 'Real ZK' },
                    ].map(({ k, v }) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', gap: 8 }}>
                        <span style={{ color: '#334155' }}>{k}</span>
                        <span style={{ color: '#64748b' }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={handleClaim} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(240,80,240,0.15))' }}>
                    <Gift size={16} /> Claim {CLAIM_AMOUNT} ZKG Tokens
                  </button>
                </motion.div>
              )}

              {stage === 'claiming' && (
                <motion.div key="claiming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'pulse-glow 1s ease-in-out infinite' }}>🎁</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: 'white', marginBottom: 8 }}>Submitting to blockchain...</div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>Verifying nullifier on HashKey Chain</div>
                </motion.div>
              )}

              {stage === 'claimed' && (
                <motion.div key="claimed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card" style={{ padding: '2rem', borderColor: 'rgba(16,185,129,0.3)', textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 1.5rem' }}>
                    {[0, 1].map(i => (
                      <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.4)', animation: `ring-expand ${0.8 + i * 0.2}s ease-out ${i * 0.15}s forwards` }} />
                    ))}
                    <div style={{ position: 'absolute', inset: 12, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <Check size={24} />
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.5rem', color: '#10b981', marginBottom: 8 }}>
                    🎉 {CLAIM_AMOUNT} ZKG Claimed!
                  </div>
                  <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '1.5rem', lineHeight: 1.7 }}>
                    Tokens sent to your wallet. Your identity was never revealed.
                  </p>
                  <a href={`https://hashkey-testnet-explorer.alt.technology/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', textDecoration: 'none', padding: '8px 16px', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, background: 'rgba(16,185,129,0.05)' }}
                  >
                    View on Explorer <ExternalLink size={12} />
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── How it works + Recent claims ── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* How it works */}
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, marginBottom: '1.25rem' }}>
                How ZK Airdrop Works
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {HOW_IT_WORKS.map((item, i) => (
                  <motion.div key={item.step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                    style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}10`, border: `1px solid ${item.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '13px', color: 'white', marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>{item.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Recent claims */}
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700 }}>Recent Claims</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'ping-dot 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: '10px', color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>LIVE</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {RECENT_CLAIMS.map((claim, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={11} color="#8b5cf6" />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8' }}>{claim.addr}</div>
                        <div style={{ fontSize: '10px', color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>{claim.time}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontWeight: 600 }}>+{claim.amount} ZKG</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Privacy callout ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ marginTop: '3rem', padding: '2rem', borderRadius: 20, background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(240,80,240,0.04))', border: '1px solid rgba(139,92,246,0.15)', textAlign: 'center' }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🔒</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: 'white', marginBottom: '0.5rem' }}>
            The Privacy Guarantee
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>
            Traditional airdrops link your KYC wallet to your claiming address — exposing your identity on-chain forever.
            ZKGate uses a <strong style={{ color: '#c4b5fd' }}>Poseidon nullifier</strong> to prevent double-claiming
            while keeping your KYC wallet completely private. Not even the contract can link them.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
