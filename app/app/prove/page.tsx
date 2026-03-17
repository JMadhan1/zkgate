'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, ArrowRight, ExternalLink } from 'lucide-react';

/* ─── Claim types ──────────────────────────────────────────────── */
const CLAIMS = [
  { id: 'AGE_VERIFIED',         label: 'Age Verified',          emoji: '🔞', color: '#00f0ff',  desc: 'Prove you are over 18 without revealing your birthdate' },
  { id: 'ACCREDITED_INVESTOR',  label: 'Accredited Investor',   emoji: '💎', color: '#8b5cf6',  desc: 'Prove accredited status for restricted DeFi products' },
  { id: 'JURISDICTION_CLEAR',   label: 'Jurisdiction Clear',    emoji: '🌍', color: '#f050f0',  desc: 'Prove you are not in a restricted jurisdiction' },
  { id: 'KYC_COMPLETE',         label: 'KYC Complete',          emoji: '✅', color: '#10b981',  desc: 'Prove full KYC verification for compliant protocols' },
  { id: 'AML_CLEAR',            label: 'AML Clear',             emoji: '🛡️', color: '#f59e0b',  desc: 'Prove you have passed anti-money laundering checks' },
];

const STEPS_TEXT = [
  'Initializing circuit...',
  'Loading witness data...',
  'Computing proof...',
  'Generating nullifier...',
  'Finalizing proof...',
  'Proof complete!',
];

/* ─── Proof rings animation ─────────────────────────────────────── */
const ProofRings = ({ progress, complete }: { progress: number; complete: boolean }) => (
  <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
    {/* Expand-out rings on success */}
    {complete && (
      <>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(16,185,129,0.6)',
              animation: `ring-expand ${0.8 + i * 0.2}s ease-out ${i * 0.15}s forwards`,
            }}
          />
        ))}
      </>
    )}

    {/* Ring 1 — cyan */}
    <div style={{
      position: 'absolute',
      inset: 10,
      borderRadius: '50%',
      border: '1.5px solid rgba(0,240,255,0.3)',
      animation: 'ring-rotate 3s linear infinite',
      boxShadow: complete ? '0 0 20px rgba(16,185,129,0.3)' : '0 0 10px rgba(0,240,255,0.1)',
      transition: 'box-shadow 0.5s ease',
    }} />

    {/* Ring 2 — purple dashed */}
    <div style={{
      position: 'absolute',
      inset: 28,
      borderRadius: '50%',
      border: '1.5px dashed rgba(139,92,246,0.4)',
      animation: 'ring-rotate-reverse 5s linear infinite',
    }} />

    {/* Ring 3 — pink */}
    <div style={{
      position: 'absolute',
      inset: 46,
      borderRadius: '50%',
      border: '1px solid rgba(240,80,240,0.2)',
      animation: 'ring-rotate 9s linear infinite',
    }} />

    {/* Center content */}
    <div style={{
      position: 'absolute',
      inset: 60,
      borderRadius: '50%',
      background: complete
        ? 'rgba(16,185,129,0.1)'
        : 'rgba(0,240,255,0.05)',
      border: `2px solid ${complete ? 'rgba(16,185,129,0.5)' : 'rgba(0,240,255,0.2)'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 4,
      transition: 'all 0.5s ease',
      animation: complete ? 'none' : 'pulse-glow 2s ease-in-out infinite',
    }}>
      {complete ? (
        <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={28} />
        </div>
      ) : (
        <>
          <div style={{
            fontSize: '18px',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            color: '#00f0ff',
          }}>{progress}%</div>
          <div style={{ width: 30, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #00f0ff, #8b5cf6)',
              width: `${progress}%`,
              transition: 'width 0.2s ease',
            }} />
          </div>
        </>
      )}
    </div>

    {/* Orbital dot */}
    {!complete && (
      <div style={{
        position: 'absolute',
        inset: 10,
        borderRadius: '50%',
        animation: 'ring-rotate 3s linear infinite',
      }}>
        <div style={{
          position: 'absolute',
          top: -3,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#00f0ff',
          boxShadow: '0 0 8px rgba(0,240,255,1)',
        }} />
      </div>
    )}
  </div>
);

/* ─── Page ──────────────────────────────────────────────────────── */
export default function ProvePage() {
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [stage, setStage] = useState<'select' | 'generating' | 'complete' | 'submitted'>('select');
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('');
  const [txHash, setTxHash] = useState('');
  const [nullifier, setNullifier] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedClaimData = CLAIMS.find((c) => c.id === selectedClaim);

  const handleGenerateProof = async () => {
    if (!selectedClaim) return;
    setStage('generating');
    setProgress(0);

    let p = 0;
    let stepIdx = 0;
    setStepText(STEPS_TEXT[0]);

    intervalRef.current = setInterval(() => {
      p += 2;
      if (p > 100) p = 100;
      setProgress(p);

      const newStepIdx = Math.floor((p / 100) * (STEPS_TEXT.length - 1));
      if (newStepIdx !== stepIdx) {
        stepIdx = newStepIdx;
        setStepText(STEPS_TEXT[stepIdx]);
      }

      if (p >= 100 && intervalRef.current) {
        clearInterval(intervalRef.current);
        setStage('complete');
        setTxHash('0x' + Math.random().toString(16).slice(2, 18));
        setNullifier('0x' + Math.random().toString(16).slice(2, 18));
      }
    }, 60);
  };

  const handleSubmit = () => {
    setStage('submitted');
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={{ minHeight: '100vh', paddingTop: 100, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '3rem', textAlign: 'center' }}
        >
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            letterSpacing: '-0.04em',
            color: 'white',
            marginBottom: '0.75rem',
          }}>
            Prove Your{' '}
            <span style={{
              background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Identity</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 480, margin: '0 auto' }}>
            Generate a zero-knowledge proof without revealing personal data
          </p>
        </motion.div>

        {/* ── STEP 1: SELECT CLAIM ── */}
        <AnimatePresence mode="wait">
          {stage === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#334155',
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  fontWeight: 700,
                  marginBottom: '1rem',
                }}>Step 1 — Select Claim Type</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '1rem',
                }}>
                  {CLAIMS.map((claim, i) => {
                    const isSelected = selectedClaim === claim.id;
                    return (
                      <motion.button
                        key={claim.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => setSelectedClaim(claim.id)}
                        style={{
                          position: 'relative',
                          padding: '1.5rem',
                          borderRadius: 16,
                          background: isSelected ? `${claim.color}08` : 'rgba(255,255,255,0.02)',
                          backdropFilter: 'blur(20px)',
                          border: `1px solid ${isSelected ? `${claim.color}40` : 'rgba(255,255,255,0.06)'}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                          boxShadow: isSelected ? `0 10px 40px ${claim.color}15, 0 0 0 1px ${claim.color}20` : 'none',
                        }}
                      >
                        {/* Selected checkmark */}
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: claim.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Check size={12} color="white" />
                          </div>
                        )}

                        <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{claim.emoji}</div>
                        <div style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          color: isSelected ? 'white' : '#94a3b8',
                          marginBottom: '0.5rem',
                          letterSpacing: '-0.01em',
                        }}>{claim.label}</div>
                        <div style={{
                          fontSize: '11px',
                          color: '#475569',
                          lineHeight: 1.5,
                          fontFamily: "'Inter', sans-serif",
                        }}>{claim.desc}</div>

                        {/* Ripple indicator */}
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            bottom: 12,
                            right: 12,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: claim.color,
                            animation: 'ping-dot 1.5s ease-in-out infinite',
                            opacity: 0.6,
                          }} />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {selectedClaim && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}
                >
                  <button
                    onClick={handleGenerateProof}
                    className="btn-primary animate-pulse-glow"
                    style={{ padding: '16px 48px', fontSize: '16px' }}
                  >
                    Generate ZK Proof
                    <ArrowRight size={18} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── STEP 2: GENERATING ── */}
          {stage === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}
            >
              <div className="glass-card" style={{ padding: '3rem 2.5rem' }}>
                {/* Enhanced orbs during generation */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 16,
                  background: 'radial-gradient(ellipse at center, rgba(0,240,255,0.04) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }} />

                <div style={{ marginBottom: '2.5rem' }}>
                  <div style={{
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                  }}>Step 2 — Generating Proof</div>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    color: 'white',
                  }}>{selectedClaimData?.label}</div>
                </div>

                <ProofRings progress={progress} complete={false} />

                <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    fontSize: '12px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#00f0ff',
                    marginBottom: '1rem',
                    minHeight: '1.5rem',
                    transition: 'all 0.3s ease',
                  }}>{stepText}</div>

                  {/* Progress bar */}
                  <div style={{
                    height: 4,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #00f0ff, #8b5cf6, #f050f0)',
                      backgroundSize: '200% 100%',
                      width: `${progress}%`,
                      transition: 'width 0.2s ease',
                      animation: 'gradient-shift 2s ease infinite',
                    }} />
                  </div>
                </div>

                {/* Circuit steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                  {[
                    { label: 'Witness construction', threshold: 0 },
                    { label: 'Pairing operations',   threshold: 33 },
                    { label: 'Signal serialization', threshold: 66 },
                  ].map((step) => {
                    const done = progress >= step.threshold + 25;
                    const active = progress >= step.threshold && !done;
                    return (
                      <div key={step.label} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 14px',
                        borderRadius: 8,
                        background: done ? 'rgba(16,185,129,0.05)' : active ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
                        transition: 'all 0.3s ease',
                      }}>
                        <span style={{
                          fontSize: '11px',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: done ? '#10b981' : active ? '#00f0ff' : '#334155',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}>{step.label}</span>
                        {done
                          ? <Check size={12} color="#10b981" />
                          : active
                            ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f0ff', animation: 'ping-dot 1s ease-in-out infinite', opacity: 0.7 }} />
                            : <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #334155' }} />
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: PROOF READY ── */}
          {stage === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ maxWidth: 640, margin: '0 auto' }}
            >
              <div className="glass-card" style={{
                padding: '2.5rem',
                borderColor: 'rgba(0,240,255,0.2)',
                boxShadow: '0 0 60px rgba(0,240,255,0.06)',
              }}>
                {/* Success rings */}
                <div style={{ marginBottom: '2rem', position: 'relative' }}>
                  <ProofRings progress={100} complete={true} />
                </div>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: '1.5rem',
                      background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      marginBottom: '0.5rem',
                    }}
                  >Proof Generated ✓</motion.div>
                  <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    Your zero-knowledge proof is ready to submit on-chain.
                  </p>
                </div>

                {/* Proof details */}
                <div style={{
                  background: 'rgba(5,5,20,0.9)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                }}>
                  {[
                    { label: 'Proof Hash',        val: `${txHash.slice(0, 22)}...` },
                    { label: 'Nullifier',          val: `${nullifier.slice(0, 22)}...` },
                    { label: 'Claim Type',         val: selectedClaim ?? '' },
                    { label: 'Public Signals',     val: '[0xc12e...1234, "3", 1742...]' },
                  ].map(({ label, val }) => (
                    <div key={label} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      gap: '1rem',
                    }}>
                      <span style={{ color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                      <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmit}
                  className="btn-primary animate-pulse-glow"
                  style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '15px' }}
                >
                  <Send size={16} />
                  Submit Proof On-Chain
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: SUBMITTED ── */}
          {stage === 'submitted' && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}
            >
              <div className="glass-card" style={{
                padding: '4rem 2.5rem',
                borderColor: 'rgba(16,185,129,0.3)',
                boxShadow: '0 0 80px rgba(16,185,129,0.1)',
              }}>
                {/* Expand rings */}
                <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 2rem' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '2px solid rgba(16,185,129,0.5)',
                      animation: `ring-expand ${0.8 + i * 0.2}s ease-out ${i * 0.15}s forwards`,
                    }} />
                  ))}
                  <div style={{
                    position: 'absolute',
                    inset: 20,
                    borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)',
                    border: '2px solid rgba(16,185,129,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}>
                    <Check size={32} />
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                    color: '#10b981',
                    letterSpacing: '-0.03em',
                    marginBottom: '1rem',
                  }}>✅ VERIFIED</div>

                  <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.7 }}>
                    Your identity has been verified without revealing any personal data.
                    The proof has been submitted on HashKey Chain.
                  </p>
                </motion.div>

                {/* TX Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  style={{
                    background: 'rgba(16,185,129,0.05)',
                    border: '1px solid rgba(16,185,129,0.15)',
                    borderRadius: 12,
                    padding: '1.25rem',
                    marginBottom: '2rem',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Transaction</div>
                      <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>{txHash}</div>
                    </div>
                    <a href="#" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', opacity: 0.7 }}>
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
                >
                  <button
                    onClick={() => window.location.href = '/defi-demo'}
                    className="btn-primary"
                    style={{ padding: '12px 28px' }}
                  >
                    Try DeFi Demo <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => { setStage('select'); setSelectedClaim(null); setProgress(0); }}
                    className="btn-secondary"
                    style={{ padding: '12px 24px' }}
                  >
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
