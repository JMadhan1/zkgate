'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const COMPARISONS = [
  {
    label: 'Traditional KYC',
    icon: '🏦',
    color: '#ef4444',
    compliance: true,
    privacy: false,
    decentralized: false,
  },
  {
    label: 'Anonymous DeFi',
    icon: '🌐',
    color: '#f59e0b',
    compliance: false,
    privacy: true,
    decentralized: true,
  },
  {
    label: 'ZKGate',
    icon: '🔐',
    color: '#00f0ff',
    compliance: true,
    privacy: true,
    decentralized: true,
    highlight: true,
  },
];

export function ImpossibleTriangle() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [showCenter, setShowCenter] = useState(false);

  useEffect(() => {
    if (inView) {
      const t = setTimeout(() => setShowCenter(true), 1200);
      return () => clearTimeout(t);
    }
  }, [inView]);

  return (
    <div ref={ref} style={{ padding: '5rem 24px', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
        <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.22em', fontWeight: 700, marginBottom: '1.25rem' }}>
          The Privacy Trilemma — Solved
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 3rem)', letterSpacing: '-0.04em', color: 'white', marginBottom: '1rem' }}>
          Today: Pick 2.{' '}
          <span style={{ background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            With ZKGate: Get All 3.
          </span>
        </h2>
        <p style={{ color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.7, fontSize: '0.9375rem' }}>
          Zero-knowledge proofs resolve the core contradiction between transparency and privacy in Web3.
        </p>
      </motion.div>

      {/* Triangle SVG */}
      <div style={{ position: 'relative', margin: '3rem auto', maxWidth: 500, height: 420 }}>
        <svg width="100%" height="100%" viewBox="0 0 500 420" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
          {/* Triangle outline */}
          <motion.path
            d="M250 30 L470 390 L30 390 Z"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
            fill="rgba(255,255,255,0.015)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />

          {/* Filled triangle — glowing when all three */}
          {showCenter && (
            <motion.path
              d="M250 30 L470 390 L30 390 Z"
              fill="url(#triangleGrad)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            />
          )}

          <defs>
            <linearGradient id="triangleGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.06" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#f050f0" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {/* Inner glow lines */}
          {showCenter && (
            <>
              <motion.line x1="250" y1="30"  x2="250" y2="390" stroke="rgba(0,240,255,0.08)" strokeWidth="1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
              <motion.line x1="30"  y1="390" x2="360" y2="210" stroke="rgba(139,92,246,0.08)" strokeWidth="1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} />
              <motion.line x1="470" y1="390" x2="140" y2="210" stroke="rgba(240,80,240,0.08)" strokeWidth="1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
            </>
          )}
        </svg>

        {/* Corner labels */}
        {[
          { label: 'Compliance',     sub: 'Regulatory', x: '50%', y: '0%',   tx: '-50%', ty: '0',    color: '#00f0ff', delay: 0.2 },
          { label: 'Privacy',        sub: 'User data',  x: '0%',  y: '100%', tx: '-10%', ty: '-100%', color: '#8b5cf6', delay: 0.4 },
          { label: 'Decentralized',  sub: 'On-chain',   x: '100%', y: '100%', tx: '-90%', ty: '-100%', color: '#f050f0', delay: 0.6 },
        ].map(({ label, sub, x, y, tx, ty, color, delay }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay, duration: 0.5 }}
            style={{
              position: 'absolute', left: x, top: y,
              transform: `translate(${tx}, ${ty})`,
              textAlign: 'center', pointerEvents: 'none',
            }}
          >
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', color, letterSpacing: '-0.02em' }}>{label}</div>
            <div style={{ fontSize: '11px', color: '#334155', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>{sub}</div>
          </motion.div>
        ))}

        {/* Center checkmark */}
        {showCenter && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', backdropFilter: 'blur(8px)', boxShadow: '0 0 40px rgba(0,240,255,0.15)' }}>
              <span style={{ fontSize: '1.5rem' }}>✓</span>
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '13px', background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.01em' }}>ZKGate</div>
          </motion.div>
        )}
      </div>

      {/* Comparison table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.8, duration: 0.6 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', maxWidth: 780, margin: '0 auto' }}
      >
        {COMPARISONS.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.9 + i * 0.1 }}
            style={{
              padding: '1.5rem',
              borderRadius: 16,
              background: item.highlight ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${item.highlight ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: item.highlight ? '0 0 40px rgba(0,240,255,0.06)' : 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {item.highlight && (
              <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #00f0ff, #8b5cf6, #f050f0)' }} />
            )}
            <div style={{ fontSize: '1.5rem', marginBottom: '0.625rem' }}>{item.icon}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', color: item.highlight ? 'white' : '#94a3b8', marginBottom: '1rem' }}>{item.label}</div>
            {[
              { label: 'Compliance',    val: item.compliance },
              { label: 'Privacy',       val: item.privacy },
              { label: 'Decentralized', val: item.decentralized },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '12px', color: '#475569', fontFamily: "'Inter', sans-serif" }}>{label}</span>
                <span style={{ fontSize: '14px' }}>{val ? '✅' : '❌'}</span>
              </div>
            ))}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
