'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, CheckCircle, Zap, Lock } from 'lucide-react';

const CREDENTIALS = [
  {
    type: 3, key: 'KYC_COMPLETE', icon: '🪪', title: 'KYC Complete',
    desc: 'Prove KYC without revealing identity',
    revealed: 'Nothing personal', proven: 'Passed KYC with registered issuer',
    color: '#10b981', glow: 'rgba(16,185,129,0.35)',
  },
  {
    type: 0, key: 'AGE_VERIFIED', icon: '🎂', title: 'Age Verified',
    desc: 'Prove 18+ without revealing your age',
    revealed: 'Nothing personal', proven: 'At least 18 years old',
    color: '#8b5cf6', glow: 'rgba(139,92,246,0.35)',
  },
  {
    type: 1, key: 'ACCREDITED_INVESTOR', icon: '💼', title: 'Accredited Investor',
    desc: 'Unlock premium DeFi pools instantly',
    revealed: 'Nothing personal', proven: 'Meets accredited investor criteria',
    color: '#f59e0b', glow: 'rgba(245,158,11,0.35)',
  },
  {
    type: 2, key: 'JURISDICTION_CLEAR', icon: '🌍', title: 'Sanction Free',
    desc: 'Prove clean jurisdiction status',
    revealed: 'Nothing personal', proven: 'Not on any sanctions list',
    color: '#06b6d4', glow: 'rgba(6,182,212,0.35)',
  },
] as const;

type Step = 'idle' | 'fetching' | 'proving' | 'submitting' | 'done';
const STEPS: Step[] = ['fetching', 'proving', 'submitting', 'done'];

const STEP_META = {
  fetching:   { label: 'Fetching credential from issuer...', icon: '📡' },
  proving:    { label: 'Generating ZK proof on-device...', icon: '⚡' },
  submitting: { label: 'Submitting proof on-chain...', icon: '🔗' },
  done:       { label: 'Proof verified!', icon: '✅' },
};

/* ── Particle burst on success ───────────────────────────────── */
function Particles({ color }: { color: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 24 }}>
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * 360;
        const dist = 80 + Math.random() * 60;
        const x = Math.cos((angle * Math.PI) / 180) * dist;
        const y = Math.sin((angle * Math.PI) / 180) * dist;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x, y, scale: 0 }}
            transition={{ duration: 0.8 + Math.random() * 0.4, ease: 'easeOut', delay: i * 0.02 }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 6, height: 6, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 8px ${color}`,
              marginLeft: -3, marginTop: -3,
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Animated circuit lines ──────────────────────────────────── */
function CircuitLines({ color }: { color: string }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15, pointerEvents: 'none' }}>
      <motion.line x1="0" y1="30%" x2="100%" y2="30%" stroke={color} strokeWidth="0.5"
        strokeDasharray="4 8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: 'linear' }} />
      <motion.line x1="0" y1="70%" x2="100%" y2="70%" stroke={color} strokeWidth="0.5"
        strokeDasharray="4 8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.3, ease: 'linear' }} />
      <motion.line x1="25%" y1="0" x2="25%" y2="100%" stroke={color} strokeWidth="0.5"
        strokeDasharray="4 8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.6, ease: 'linear' }} />
      <motion.line x1="75%" y1="0" x2="75%" y2="100%" stroke={color} strokeWidth="0.5"
        strokeDasharray="4 8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.9, ease: 'linear' }} />
    </svg>
  );
}

export function ProofSelector() {
  const [selected, setSelected] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [proofHash, setProofHash] = useState('');
  const [showParticles, setShowParticles] = useState(false);

  const selectedCred = CREDENTIALS.find((c) => c.type === selected);
  const isGenerating = step !== 'idle' && step !== 'done';
  const isDone = step === 'done';

  const handleGenerate = async () => {
    if (selected === null) return;
    setStep('fetching');
    for (const s of STEPS) {
      await new Promise((r) => setTimeout(r, 600));
      setStep(s);
      if (s === 'done') {
        setProofHash('0x' + Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''));
        setShowParticles(true);
        setTimeout(() => setShowParticles(false), 1200);
      }
    }
  };

  const reset = () => { setStep('idle'); setProofHash(''); setSelected(null); };

  const stepIdx = STEPS.indexOf(step as Step);

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <AnimatePresence mode="wait">

        {/* ── SELECTOR + GENERATING STATE ─────────────────── */}
        {!isDone && (
          <motion.div key="selector"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24, scale: 0.97 }} transition={{ duration: 0.4 }}>

            {/* Credential grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {CREDENTIALS.map((cred, idx) => {
                const isActive = selected === cred.type;
                return (
                  <motion.button
                    key={cred.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.45 }}
                    onClick={() => !isGenerating && setSelected(cred.type)}
                    whileHover={!isGenerating ? { y: -6, scale: 1.02 } : {}}
                    whileTap={!isGenerating ? { scale: 0.97 } : {}}
                    style={{
                      position: 'relative', padding: '1.5rem', borderRadius: 20,
                      border: isActive ? `1px solid ${cred.color}70` : '1px solid rgba(255,255,255,0.07)',
                      background: isActive
                        ? `linear-gradient(135deg, ${cred.color}12, ${cred.color}06)`
                        : 'rgba(255,255,255,0.02)',
                      textAlign: 'left', cursor: isGenerating ? 'not-allowed' : 'pointer',
                      opacity: isGenerating && !isActive ? 0.35 : 1,
                      boxShadow: isActive ? `0 0 32px ${cred.glow}, 0 8px 32px rgba(0,0,0,0.3)` : '0 4px 16px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Active glow sweep */}
                    {isActive && (
                      <motion.div
                        initial={{ x: '-100%' }} animate={{ x: '200%' }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                        style={{
                          position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
                          background: `linear-gradient(90deg, transparent, ${cred.color}18, transparent)`,
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* Selected checkmark */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          style={{
                            position: 'absolute', top: 12, right: 12,
                            width: 22, height: 22, borderRadius: '50%',
                            background: `linear-gradient(135deg, ${cred.color}, ${cred.color}cc)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 0 12px ${cred.glow}`,
                          }}
                        >
                          <CheckCircle size={13} color="white" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Icon with glow ring */}
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
                      <motion.div
                        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{
                          width: 52, height: 52, borderRadius: 14,
                          background: isActive ? `${cred.color}20` : 'rgba(255,255,255,0.04)',
                          border: isActive ? `1px solid ${cred.color}50` : '1px solid rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 24,
                          boxShadow: isActive ? `0 0 20px ${cred.glow}` : 'none',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {cred.icon}
                      </motion.div>
                    </div>

                    <div style={{
                      fontSize: 15, fontWeight: 700, color: 'white',
                      fontFamily: "'Space Grotesk', sans-serif",
                      marginBottom: 6, letterSpacing: '-0.02em',
                    }}>{cred.title}</div>

                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, marginBottom: '1rem' }}>
                      {cred.desc}
                    </div>

                    {/* Privacy pill */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 100,
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.2)',
                    }}>
                      <Lock size={9} color="#10b981" />
                      <span style={{ fontSize: 9, color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Zero data leaked
                      </span>
                    </div>

                    {/* Bottom color accent */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                      background: isActive ? `linear-gradient(90deg, transparent, ${cred.color}, transparent)` : 'transparent',
                      transition: 'all 0.3s ease',
                    }} />
                  </motion.button>
                );
              })}
            </div>

            {/* Generate / Loading area */}
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div key="loading"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    padding: '2rem',
                    borderRadius: 20,
                    border: `1px solid ${selectedCred?.color}30`,
                    background: `linear-gradient(135deg, ${selectedCred?.color}08, rgba(0,0,0,0.2))`,
                    boxShadow: `0 0 40px ${selectedCred?.glow}`,
                    position: 'relative', overflow: 'hidden',
                  }}>
                  <CircuitLines color={selectedCred?.color ?? '#00f0ff'} />

                  {/* Steps */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, marginBottom: '1.75rem', position: 'relative', zIndex: 1 }}>
                    {STEPS.slice(0, -1).map((s, i) => {
                      const done = i < stepIdx;
                      const active = STEPS[i] === step;
                      const stepMeta = STEP_META[s as keyof typeof STEP_META];
                      return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                          <motion.div
                            animate={active ? { scale: [1, 1.12, 1], boxShadow: [`0 0 0px ${selectedCred?.glow}`, `0 0 20px ${selectedCred?.glow}`, `0 0 0px ${selectedCred?.glow}`] } : {}}
                            transition={{ duration: 1.4, repeat: Infinity }}
                            style={{
                              width: 44, height: 44, borderRadius: '50%',
                              background: done
                                ? `linear-gradient(135deg, #10b981, #059669)`
                                : active
                                ? `linear-gradient(135deg, ${selectedCred?.color}, ${selectedCred?.color}aa)`
                                : 'rgba(255,255,255,0.06)',
                              border: `2px solid ${done ? '#10b981' : active ? selectedCred?.color ?? '#00f0ff' : 'rgba(255,255,255,0.1)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.5s ease',
                              fontSize: done ? 16 : active ? 14 : 18,
                              flexShrink: 0,
                            }}
                          >
                            {done ? '✓' : active ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                                style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
                              />
                            ) : (
                              <span style={{ fontSize: 16, opacity: 0.4 }}>{stepMeta.icon}</span>
                            )}
                          </motion.div>

                          {i < 2 && (
                            <div style={{ width: 40, height: 2, position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', margin: '0 4px' }}>
                              <motion.div
                                initial={{ width: '0%' }} animate={{ width: done ? '100%' : '0%' }}
                                transition={{ duration: 0.5 }}
                                style={{ height: '100%', background: `linear-gradient(90deg, #10b981, ${selectedCred?.color})` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Step label */}
                  <AnimatePresence mode="wait">
                    <motion.div key={step}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                      style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                      <div style={{
                        fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
                        color: selectedCred?.color ?? '#00f0ff', fontWeight: 700, marginBottom: 6,
                      }}>
                        {(step in STEP_META) && STEP_META[step as keyof typeof STEP_META]?.icon} {(step in STEP_META) && STEP_META[step as keyof typeof STEP_META]?.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', fontFamily: "'Inter', sans-serif" }}>
                        Private data never leaves your device
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ display: 'flex', justifyContent: 'center' }}>
                  <motion.button
                    onClick={handleGenerate}
                    disabled={selected === null}
                    whileHover={selected !== null ? { scale: 1.04, y: -2 } : {}}
                    whileTap={selected !== null ? { scale: 0.97 } : {}}
                    style={{
                      padding: '16px 44px', borderRadius: 14,
                      border: selected === null ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      background: selected !== null
                        ? `linear-gradient(135deg, ${selectedCred?.color}, ${selectedCred?.color}bb)`
                        : 'rgba(255,255,255,0.04)',
                      color: selected === null ? '#475569' : 'white',
                      fontSize: 15, fontWeight: 700,
                      cursor: selected === null ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontFamily: "'Space Grotesk', sans-serif",
                      boxShadow: selected !== null ? `0 0 40px ${selectedCred?.glow}, 0 8px 24px rgba(0,0,0,0.3)` : 'none',
                      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {selected !== null && (
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                        style={{
                          position: 'absolute', inset: 0, width: '40%',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    <Zap size={17} />
                    {selected === null ? 'Select a credential above' : `Generate ${selectedCred?.title} Proof`}
                    {selected !== null && <ArrowRight size={16} />}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── DONE STATE ───────────────────────────────────── */}
        {isDone && (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{
              position: 'relative', padding: '3rem 2rem', borderRadius: 24, textAlign: 'center',
              border: `1px solid ${selectedCred?.color}50`,
              background: `linear-gradient(135deg, ${selectedCred?.color}10, rgba(0,0,0,0.3), ${selectedCred?.color}06)`,
              boxShadow: `0 0 60px ${selectedCred?.glow}, 0 20px 60px rgba(0,0,0,0.4)`,
              overflow: 'hidden',
            }}>
            {showParticles && <Particles color={selectedCred?.color ?? '#10b981'} />}
            <CircuitLines color={selectedCred?.color ?? '#10b981'} />

            {/* Success rings */}
            {[1, 2, 3].map((i) => (
              <motion.div key={i}
                initial={{ scale: 0.5, opacity: 0.8 }} animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 1.2, delay: i * 0.2, ease: 'easeOut' }}
                style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  width: 80, height: 80, borderRadius: '50%',
                  border: `1px solid ${selectedCred?.color}`,
                  pointerEvents: 'none',
                }}
              />
            ))}

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
              style={{
                width: 80, height: 80, borderRadius: 22, margin: '0 auto 1.5rem',
                background: `linear-gradient(135deg, ${selectedCred?.color}30, ${selectedCred?.color}10)`,
                border: `2px solid ${selectedCred?.color}60`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36,
                boxShadow: `0 0 40px ${selectedCred?.glow}`,
                position: 'relative', zIndex: 1,
              }}
            >
              {selectedCred?.icon}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 14px', borderRadius: 100, marginBottom: '1rem',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                fontSize: 11, color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              }}>
                <ShieldCheck size={11} /> PROOF VERIFIED ON-CHAIN
              </div>

              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: 'white',
                fontFamily: "'Space Grotesk', sans-serif", marginBottom: '0.5rem', letterSpacing: '-0.03em',
              }}>
                {selectedCred?.title}
              </div>
              <div style={{ fontSize: 14, color: '#64748b', marginBottom: '2rem' }}>
                Your identity is verified. Zero personal data was revealed.
              </div>

              {/* Proof hash */}
              <div style={{
                padding: '0.875rem 1.25rem',
                background: 'rgba(0,0,0,0.4)', borderRadius: 12,
                border: `1px solid ${selectedCred?.color}25`,
                marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Proof Hash
                </span>
                <span style={{ fontSize: 12, color: selectedCred?.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                  {proofHash.slice(0, 18)}...{proofHash.slice(-6)}
                </span>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                {[selectedCred?.key, 'On-Chain ✓', 'Groth16 Proof', 'HashKey Chain'].map((tag, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    style={{
                      padding: '5px 14px', borderRadius: 100,
                      background: i === 0 ? `${selectedCred?.color}18` : 'rgba(255,255,255,0.05)',
                      border: i === 0 ? `1px solid ${selectedCred?.color}40` : '1px solid rgba(255,255,255,0.08)',
                      fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                      color: i === 0 ? selectedCred?.color : '#64748b', fontWeight: 700,
                    }}>
                    {tag}
                  </motion.div>
                ))}
              </div>

              <button onClick={reset} style={{
                padding: '10px 28px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#64748b', fontSize: 13, cursor: 'pointer',
                fontFamily: "'Inter', sans-serif", transition: 'all 0.2s ease',
              }}
                onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.target as HTMLElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.target as HTMLElement).style.color = '#64748b'; }}
              >
                ← Prove another credential
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
