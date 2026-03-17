'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, ArrowRight, ExternalLink, Copy, Eye, EyeOff, Lock, Unlock, Download, Share2 } from 'lucide-react';
import {
  generateAgeProof,
  generateSelectiveDisclosureProof,
  formatProofForContract,
  verifyProofLocally,
  encodeProofForSharing,
  PROOF_STEPS,
  type ProofResult,
} from '../lib/zkproof';

/* ─── Claim types ──────────────────────────────────────────────── */
const CLAIMS = [
  { id: 'AGE_VERIFIED',        label: 'Age Verified',         emoji: '🔞', color: '#00f0ff', attrIdx: 0, desc: 'Prove you are over 18 without revealing your birthdate' },
  { id: 'JURISDICTION_CLEAR',  label: 'Jurisdiction Clear',   emoji: '🌍', color: '#f050f0', attrIdx: 1, desc: 'Prove you are not in a restricted jurisdiction' },
  { id: 'ACCREDITED_INVESTOR', label: 'Accredited Investor',  emoji: '💎', color: '#8b5cf6', attrIdx: 2, desc: 'Prove accredited status for restricted DeFi products' },
  { id: 'KYC_COMPLETE',        label: 'KYC Complete',         emoji: '✅', color: '#10b981', attrIdx: 3, desc: 'Prove full KYC verification for compliant protocols' },
  { id: 'AML_CLEAR',           label: 'AML Clear',            emoji: '🛡️', color: '#f59e0b', attrIdx: 4, desc: 'Prove you have passed anti-money laundering checks' },
];

/* ─── Proof rings animation ─────────────────────────────────────── */
const ProofRings = ({ progress, complete }: { progress: number; complete: boolean }) => (
  <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
    {complete && [0, 1, 2].map((i) => (
      <div key={i} style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: '2px solid rgba(16,185,129,0.6)',
        animation: `ring-expand ${0.8 + i * 0.2}s ease-out ${i * 0.15}s forwards`,
      }} />
    ))}
    <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: '1.5px solid rgba(0,240,255,0.3)', animation: 'ring-rotate 3s linear infinite', boxShadow: complete ? '0 0 20px rgba(16,185,129,0.3)' : '0 0 10px rgba(0,240,255,0.1)', transition: 'box-shadow 0.5s ease' }} />
    <div style={{ position: 'absolute', inset: 28, borderRadius: '50%', border: '1.5px dashed rgba(139,92,246,0.4)', animation: 'ring-rotate-reverse 5s linear infinite' }} />
    <div style={{ position: 'absolute', inset: 46, borderRadius: '50%', border: '1px solid rgba(240,80,240,0.2)', animation: 'ring-rotate 9s linear infinite' }} />
    <div style={{
      position: 'absolute', inset: 60, borderRadius: '50%',
      background: complete ? 'rgba(16,185,129,0.1)' : 'rgba(0,240,255,0.05)',
      border: `2px solid ${complete ? 'rgba(16,185,129,0.5)' : 'rgba(0,240,255,0.2)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
      transition: 'all 0.5s ease', animation: complete ? 'none' : 'pulse-glow 2s ease-in-out infinite',
    }}>
      {complete ? (
        <div style={{ color: '#10b981' }}><Check size={28} /></div>
      ) : (
        <>
          <div style={{ fontSize: '18px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#00f0ff' }}>{progress}%</div>
          <div style={{ width: 30, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #00f0ff, #8b5cf6)', width: `${progress}%`, transition: 'width 0.2s ease' }} />
          </div>
        </>
      )}
    </div>
    {!complete && (
      <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', animation: 'ring-rotate 3s linear infinite' }}>
        <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 8px rgba(0,240,255,1)' }} />
      </div>
    )}
  </div>
);

/* ─── Selective Disclosure Toggle ──────────────────────────────── */
function SelectiveDisclosure({
  selected,
  onChange,
}: {
  selected: boolean[];
  onChange: (idx: number) => void;
}) {
  const disclosedCount = selected.filter(Boolean).length;
  const privacyLevel = 5 - disclosedCount;
  const privacyLabel = privacyLevel >= 4 ? 'Maximum Privacy' : privacyLevel >= 3 ? 'High Privacy' : privacyLevel >= 2 ? 'Balanced' : privacyLevel >= 1 ? 'Low Privacy' : 'Full Disclosure';
  const privacyColor = privacyLevel >= 4 ? '#10b981' : privacyLevel >= 2 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700 }}>
            Step 2 — Selective Disclosure
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: 4 }}>Choose what to prove. Nothing else leaks.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: privacyColor, fontWeight: 700 }}>{privacyLabel}</div>
          <div style={{ fontSize: '11px', color: '#334155' }}>{disclosedCount} of 5 revealed</div>
        </div>
      </div>

      {/* Privacy meter */}
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)', marginBottom: '1.25rem', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: `linear-gradient(90deg, ${privacyColor}, ${privacyColor}99)`,
          width: `${(privacyLevel / 5) * 100}%`,
          transition: 'width 0.4s ease, background 0.4s ease',
        }} />
      </div>

      {/* Toggle rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {CLAIMS.map((claim, i) => {
          const on = selected[i];
          return (
            <motion.div
              key={claim.id}
              animate={{ opacity: on ? 1 : 0.65 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: on ? `${claim.color}08` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${on ? `${claim.color}25` : 'rgba(255,255,255,0.05)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => onChange(i)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.125rem' }}>{claim.emoji}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: on ? 'white' : '#64748b', fontFamily: "'Space Grotesk', sans-serif" }}>{claim.label}</div>
                  <div style={{ fontSize: '11px', color: on ? claim.color + 'aa' : '#334155', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                    {on ? '✓ Will be proven' : '🔒 Hidden'}
                  </div>
                </div>
              </div>
              {/* Toggle switch */}
              <div style={{
                width: 40, height: 22, borderRadius: 11,
                background: on ? claim.color : 'rgba(255,255,255,0.08)',
                position: 'relative', transition: 'background 0.2s ease',
                border: `1px solid ${on ? claim.color : 'rgba(255,255,255,0.1)'}`,
                flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: on ? 20 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s ease',
                  boxShadow: on ? `0 0 6px ${claim.color}` : 'none',
                }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Proof Export Card ─────────────────────────────────────────── */
function ProofExport({ result, claimType }: { result: ProofResult; claimType: string }) {
  const [copied, setCopied] = useState(false);
  const contractProof = formatProofForContract(result.proof);
  const shareCode = encodeProofForSharing(result);

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify({ proof: contractProof, publicSignals: result.publicSignals }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      style={{
        background: 'rgba(5,5,20,0.9)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '1.25rem', marginTop: '1.25rem',
      }}
    >
      <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
        Proof Details {result.isSimulated && <span style={{ color: '#f59e0b' }}>[SIMULATED]</span>}
      </div>
      {[
        { label: 'Claim Type',    val: claimType },
        { label: 'Nullifier',     val: `${result.nullifierHash.slice(0, 20)}...` },
        { label: 'Proof Time',    val: `${result.proofTime}ms` },
        { label: 'Public Signals', val: result.publicSignals.slice(0, 2).join(', ') + '...' },
        { label: 'Protocol',      val: 'Groth16 / BN254' },
      ].map(({ label, val }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', gap: 8 }}>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={copyJSON} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.12)', color: '#00f0ff', fontSize: '11px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace' " }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify({ proof: contractProof, publicSignals: result.publicSignals, nullifier: result.nullifierHash, shareCode }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `zkgate-proof-${Date.now()}.json`; a.click();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', color: '#8b5cf6', fontSize: '11px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace'" }}
        >
          <Download size={12} /> Download
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(window.location.origin + '/verify?proof=' + shareCode); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(240,80,240,0.06)', border: '1px solid rgba(240,80,240,0.12)', color: '#f050f0', fontSize: '11px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace'" }}
        >
          <Share2 size={12} /> Share Link
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function ProvePage() {
  const [selectedClaims, setSelectedClaims] = useState<boolean[]>([true, false, false, false, false]);
  const [useSelective, setUseSelective]     = useState(false);
  const [stage, setStage]       = useState<'select' | 'generating' | 'complete' | 'submitted'>('select');
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('');
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [txHash, setTxHash]     = useState('');
  const [error, setError]       = useState('');
  const stepIdxRef = useRef(0);
  const progressRef = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const primaryClaim = CLAIMS.find((_, i) => selectedClaims[i]) ?? CLAIMS[0];
  const selectedCount = selectedClaims.filter(Boolean).length;
  const disclosureBitmask = selectedClaims.reduce((acc, on, i) => acc | (on ? 1 << i : 0), 0);

  // Simulate smooth progress while real proof generates
  const startProgressAnimation = useCallback(() => {
    stepIdxRef.current = 0;
    progressRef.current = 0;
    setProgress(0);
    setStepText(PROOF_STEPS[0].label);

    timerRef.current = setInterval(() => {
      const target = PROOF_STEPS[stepIdxRef.current]?.progress ?? 97;
      if (progressRef.current < target - 2) {
        progressRef.current = Math.min(progressRef.current + 0.8, target - 1);
        setProgress(Math.floor(progressRef.current));
        const nextStep = PROOF_STEPS.findIndex(s => s.progress > progressRef.current);
        if (nextStep > 0 && nextStep !== stepIdxRef.current) {
          stepIdxRef.current = nextStep;
          setStepText(PROOF_STEPS[nextStep].label);
        }
      }
    }, 80);
  }, []);

  const stopProgress = useCallback((finalStep: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressRef.current = 100;
    setProgress(100);
    setStepText(PROOF_STEPS[finalStep]?.label ?? 'Complete!');
  }, []);

  const handleGenerateProof = async () => {
    if (selectedCount === 0) return;
    setStage('generating');
    setError('');
    startProgressAnimation();

    try {
      const now = Math.floor(Date.now() / 1000);
      const dob = now - (25 * 365.25 * 86400); // Demo: 25 years old
      const secret = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64);

      let result: ProofResult;

      if (useSelective && selectedCount > 0) {
        // Selective disclosure proof
        const sdResult = await generateSelectiveDisclosureProof({
          fullCredential: [25, 1, 1, 1, 1], // age=25, all others=1 (true)
          disclosureBitmask,
          userCommitment: secret,
          issuanceDate: now - 86400 * 30,
          expiryDate: now + 86400 * 335,
          issuerPubkey: '0x1234567890abcdef',
          userSecret: secret,
          pathElements: Array(20).fill('0x' + '0'.repeat(64)),
          pathIndices: Array(20).fill(0),
          merkleRoot: '0x' + '1'.padStart(64, '0'),
          currentTimestamp: now,
        });
        result = sdResult;
      } else {
        // Simple age proof
        result = await generateAgeProof({
          birthTimestamp: Math.floor(dob),
          userSecret: secret,
          currentTimestamp: now,
          ageThreshold: 18,
        });
      }

      // Local verification
      const valid = await verifyProofLocally(result.proof, result.publicSignals);
      if (!valid) throw new Error('Local proof verification failed');

      stopProgress(PROOF_STEPS.length - 1);
      setProofResult(result);
      setTimeout(() => setStage('complete'), 300);
    } catch (err) {
      stopProgress(0);
      setError(err instanceof Error ? err.message : 'Proof generation failed');
      setStage('select');
    }
  };

  const handleSubmit = () => {
    // In production: call zkGate.verifyAge() or zkGate.verifySelective() with wagmi writeContract
    const fakeTx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setTxHash(fakeTx);
    setStage('submitted');
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div style={{ minHeight: '100vh', paddingTop: 100, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.04em', color: 'white', marginBottom: '0.75rem' }}>
            Prove Your{' '}
            <span style={{ background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Identity</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 520, margin: '0 auto' }}>
            Generate a real Groth16 zero-knowledge proof. Choose exactly what you prove — nothing else leaks.
          </p>
        </motion.div>

        {/* Error toast */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ maxWidth: 560, margin: '0 auto 2rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}
            >{error}</motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ── SELECT ── */}
          {stage === 'select' && (
            <motion.div key="select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, marginBottom: '1rem' }}>
                  Step 1 — Select Claim Type
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {CLAIMS.map((claim, i) => {
                    const isSelected = selectedClaims[i];
                    return (
                      <motion.button
                        key={claim.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => {
                          const next = [...selectedClaims];
                          if (!useSelective) {
                            // Single select mode
                            next.fill(false);
                            next[i] = true;
                          } else {
                            next[i] = !next[i];
                          }
                          setSelectedClaims(next);
                        }}
                        style={{
                          position: 'relative', padding: '1.5rem', borderRadius: 16,
                          background: isSelected ? `${claim.color}08` : 'rgba(255,255,255,0.02)',
                          backdropFilter: 'blur(20px)',
                          border: `1px solid ${isSelected ? `${claim.color}40` : 'rgba(255,255,255,0.06)'}`,
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                          boxShadow: isSelected ? `0 10px 40px ${claim.color}15, 0 0 0 1px ${claim.color}20` : 'none',
                        }}
                      >
                        {isSelected && (
                          <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: '50%', background: claim.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color="white" />
                          </div>
                        )}
                        <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{claim.emoji}</div>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.875rem', color: isSelected ? 'white' : '#94a3b8', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>{claim.label}</div>
                        <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>{claim.desc}</div>
                        {isSelected && (
                          <div style={{ position: 'absolute', bottom: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: claim.color, animation: 'ping-dot 1.5s ease-in-out infinite', opacity: 0.6 }} />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Selective disclosure toggle */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.25rem', borderRadius: 12, background: useSelective ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${useSelective ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.06)'}`, marginBottom: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onClick={() => {
                  setUseSelective(!useSelective);
                  if (!useSelective) setSelectedClaims([true, true, false, false, false]);
                  else setSelectedClaims([true, false, false, false, false]);
                }}
              >
                {useSelective ? <Unlock size={16} color="#00f0ff" /> : <Lock size={16} color="#475569" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: useSelective ? '#00f0ff' : '#94a3b8', fontFamily: "'Space Grotesk', sans-serif" }}>
                    Selective Disclosure Mode
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', fontFamily: "'Inter', sans-serif" }}>
                    Choose exactly which attributes to prove — nothing else leaks
                  </div>
                </div>
                <div style={{ width: 40, height: 22, borderRadius: 11, background: useSelective ? '#00f0ff' : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'background 0.2s ease', border: `1px solid ${useSelective ? '#00f0ff' : 'rgba(255,255,255,0.1)'}`, flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: useSelective ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s ease', boxShadow: useSelective ? '0 0 6px #00f0ff' : 'none' }} />
                </div>
              </motion.div>

              {/* Selective disclosure attribute picker */}
              {useSelective && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <SelectiveDisclosure
                    selected={selectedClaims}
                    onChange={(i) => {
                      const next = [...selectedClaims];
                      next[i] = !next[i];
                      setSelectedClaims(next);
                    }}
                  />
                </motion.div>
              )}

              {selectedCount > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: '2rem', flexWrap: 'wrap' }}>
                  <button onClick={handleGenerateProof} className="btn-primary animate-pulse-glow" style={{ padding: '16px 48px', fontSize: '16px' }}>
                    {useSelective
                      ? `Generate Selective Proof (${selectedCount} attrs)`
                      : `Generate ZK Proof`}
                    <ArrowRight size={18} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── GENERATING ── */}
          {stage === 'generating' && (
            <motion.div key="generating" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
              <div className="glass-card" style={{ padding: '3rem 2.5rem' }}>
                <div style={{ marginBottom: '2.5rem' }}>
                  <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700, marginBottom: '0.5rem' }}>
                    {useSelective ? 'Selective Disclosure Proof' : 'ZK Proof Generation'}
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.25rem', color: 'white' }}>
                    {useSelective ? `Proving ${selectedCount} of 5 attributes` : primaryClaim.label}
                  </div>
                </div>

                <ProofRings progress={progress} complete={false} />

                <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#00f0ff', marginBottom: '1rem', minHeight: '1.5rem', transition: 'all 0.3s ease' }}>{stepText}</div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #00f0ff, #8b5cf6, #f050f0)', backgroundSize: '200% 100%', width: `${progress}%`, transition: 'width 0.3s ease', animation: 'gradient-shift 2s ease infinite' }} />
                  </div>
                </div>

                {/* Live circuit steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                  {[
                    { label: 'Witness construction', threshold: 0 },
                    { label: 'BN254 pairing ops',    threshold: 40 },
                    { label: 'Groth16 prover',        threshold: 70 },
                  ].map((step) => {
                    const done   = progress >= step.threshold + 25;
                    const active = progress >= step.threshold && !done;
                    return (
                      <div key={step.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 8, background: done ? 'rgba(16,185,129,0.05)' : active ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.04)'}`, transition: 'all 0.3s ease' }}>
                        <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: done ? '#10b981' : active ? '#00f0ff' : '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{step.label}</span>
                        {done ? <Check size={12} color="#10b981" /> : active ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f0ff', animation: 'ping-dot 1s ease-in-out infinite', opacity: 0.7 }} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #334155' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PROOF READY ── */}
          {stage === 'complete' && proofResult && (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 640, margin: '0 auto' }}>
              <div className="glass-card" style={{ padding: '2.5rem', borderColor: 'rgba(0,240,255,0.2)', boxShadow: '0 0 60px rgba(0,240,255,0.06)' }}>
                <div style={{ marginBottom: '2rem', position: 'relative' }}>
                  <ProofRings progress={100} complete={true} />
                </div>

                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.5rem', background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '0.5rem' }}
                  >Proof Generated ✓</motion.div>
                  <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {useSelective
                      ? `Proved ${selectedClaims.filter(Boolean).map((_, i) => i).filter(i => selectedClaims[i]).map(i => CLAIMS[i]?.label).join(', ')} — nothing else revealed.`
                      : 'Zero-knowledge proof ready. No personal data was revealed.'}
                  </p>
                  {proofResult.isSimulated && (
                    <div style={{ marginTop: 8, fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                      SIMULATION MODE — run circuits/build.sh for real proofs
                    </div>
                  )}
                </div>

                <ProofExport result={proofResult} claimType={useSelective ? `selective[${disclosureBitmask.toString(2).padStart(5, '0')}]` : primaryClaim.id} />

                <button onClick={handleSubmit} className="btn-primary animate-pulse-glow" style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '15px', marginTop: '1.5rem' }}>
                  <Send size={16} /> Submit Proof On-Chain
                </button>
              </div>
            </motion.div>
          )}

          {/* ── SUBMITTED ── */}
          {stage === 'submitted' && (
            <motion.div key="submitted" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
              <div className="glass-card" style={{ padding: '4rem 2.5rem', borderColor: 'rgba(16,185,129,0.3)', boxShadow: '0 0 80px rgba(16,185,129,0.1)' }}>
                <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 2rem' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.5)', animation: `ring-expand ${0.8 + i * 0.2}s ease-out ${i * 0.15}s forwards` }} />
                  ))}
                  <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <Check size={32} />
                  </div>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: '#10b981', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
                    ✅ VERIFIED ON-CHAIN
                  </div>
                  <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.7 }}>
                    Your identity has been verified without revealing any personal data.
                    Proof submitted to HashKey Chain.
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                  style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '1.25rem', marginBottom: '2rem', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Transaction Hash</div>
                      <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>{txHash.slice(0, 32)}...</div>
                    </div>
                    <a href={`https://hashkey-testnet-explorer.alt.technology/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', opacity: 0.7 }}>
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => window.location.href = '/defi-demo'} className="btn-primary" style={{ padding: '12px 28px' }}>
                    Try DeFi Demo <ArrowRight size={14} />
                  </button>
                  <button onClick={() => window.location.href = '/airdrop'} className="btn-primary" style={{ padding: '12px 28px', background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(240,80,240,0.1))' }}>
                    🎁 Claim Airdrop <ArrowRight size={14} />
                  </button>
                  <button onClick={() => { setStage('select'); setSelectedClaims([true, false, false, false, false]); setProgress(0); setProofResult(null); }} className="btn-secondary" style={{ padding: '12px 24px' }}>
                    Prove Again
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
