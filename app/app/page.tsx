'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Lock, Zap, Shield, Github, BarChart2 } from 'lucide-react';
import { TypingText } from './components/TypingText';
import { ImpossibleTriangle } from './components/ImpossibleTriangle';
import { ProofSelector } from './components/ProofSelector';
import { ZKBadgeDisplay } from './components/ZKBadge';
import { DeFiDemo } from './components/DeFiDemo';

/* ─── Animated counter ─────────────────────────────────────────── */
const Counter = ({ target, suffix = '' }: { target: number | string; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView || typeof target !== 'number') return;
    let start = 0;
    const step = Math.ceil(target / 40);
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(start);
    }, 40);
    return () => clearInterval(id);
  }, [inView, target]);

  if (typeof target === 'string') return <span ref={ref}>{target}</span>;
  return <span ref={ref}>{val.toLocaleString()}</span>;
};

/* ─── Shield Hero Visual ───────────────────────────────────────── */
const ShieldVisual = () => (
  <div style={{ position: 'relative', width: 320, height: 320, margin: '0 auto' }}>
    {/* Rotating rings */}
    {[140, 116, 92].map((size, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          border: `1px solid ${i === 0 ? 'rgba(0,240,255,0.25)' : i === 1 ? 'rgba(139,92,246,0.35)' : 'rgba(240,80,240,0.2)'}`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: `${i % 2 === 0 ? 'ring-rotate' : 'ring-rotate-reverse'} ${4 + i * 2}s linear infinite`,
          boxShadow: i === 0 ? '0 0 15px rgba(0,240,255,0.08)' : 'none',
        }}
      />
    ))}

    {/* Data flow particles left */}
    {[0, 1, 2].map((i) => (
      <div
        key={`left-${i}`}
        style={{
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#00f0ff',
          top: `${40 + i * 10}%`,
          left: '2%',
          animation: `data-flow ${1.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
          boxShadow: '0 0 8px rgba(0,240,255,0.8)',
          opacity: 0,
        }}
      />
    ))}

    {/* Proof checkmark particles right */}
    {[0, 1].map((i) => (
      <div
        key={`right-${i}`}
        style={{
          position: 'absolute',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#10b981',
          top: `${45 + i * 10}%`,
          right: '2%',
          animation: `data-flow ${1.8 + i * 0.4}s ease-in-out ${0.8 + i * 0.4}s infinite`,
          boxShadow: '0 0 8px rgba(16,185,129,0.8)',
          opacity: 0,
        }}
      />
    ))}

    {/* Center shield */}
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 72,
      height: 72,
      borderRadius: '50%',
      background: 'rgba(0,240,255,0.08)',
      border: '1px solid rgba(0,240,255,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'pulse-glow 3s ease-in-out infinite',
    }}>
      <svg width="32" height="36" viewBox="0 0 32 36" fill="none">
        <path
          d="M16 2L4 7V16C4 23.7 9.3 30.8 16 33C22.7 30.8 28 23.7 28 16V7L16 2Z"
          stroke="#00f0ff"
          strokeWidth="1.5"
          fill="rgba(0,240,255,0.05)"
          strokeLinejoin="round"
        />
        <path
          d="M11 17L14.5 20.5L21 13"
          stroke="#00f0ff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>

    {/* "DATA IN" label */}
    <div style={{
      position: 'absolute',
      left: '-20px',
      top: '46%',
      transform: 'translateY(-50%)',
      fontSize: '9px',
      fontFamily: "'JetBrains Mono', monospace",
      color: 'rgba(0,240,255,0.5)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>← data in</div>

    {/* "PROOF OUT" label */}
    <div style={{
      position: 'absolute',
      right: '-28px',
      top: '46%',
      transform: 'translateY(-50%)',
      fontSize: '9px',
      fontFamily: "'JetBrains Mono', monospace",
      color: 'rgba(16,185,129,0.6)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>proof out →</div>
  </div>
);

/* ─── Feature Card ─────────────────────────────────────────────── */
const FeatureCard = ({
  icon, title, desc, color, delay
}: {
  icon: React.ReactNode; title: string; desc: string; color: string; delay: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      className="glass-card"
      style={{ padding: '2rem' }}
    >
      <div style={{
        width: 52,
        height: 52,
        borderRadius: '14px',
        background: `${color}14`,
        border: `1px solid ${color}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        color,
        fontSize: '1.5rem',
      }}>
        {icon}
      </div>
      <h3 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: '1.125rem',
        color: 'white',
        marginBottom: '0.75rem',
        letterSpacing: '-0.02em',
      }}>{title}</h3>
      <p style={{
        color: '#64748b',
        fontSize: '0.875rem',
        lineHeight: 1.7,
      }}>{desc}</p>
    </motion.div>
  );
};

/* ─── How It Works Step ────────────────────────────────────────── */
const Step = ({ n, title, desc, delay }: { n: string; title: string; desc: string; delay: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}
    >
      <div className="step-number">{n}</div>
      <h4 style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: '1.1rem',
        color: 'white',
        letterSpacing: '-0.02em',
      }}>{title}</h4>
      <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.7 }}>{desc}</p>
    </motion.div>
  );
};

/* ─── Stat Card ────────────────────────────────────────────────── */
const StatCard = ({
  value, label, suffix = '', delay
}: {
  value: number | string; label: string; suffix?: string; delay: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay }}
      className="glass-card card-gradient-top"
      style={{ padding: '2rem', textAlign: 'center' }}
    >
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: 'clamp(2rem, 4vw, 3rem)',
        background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: '0.5rem',
        letterSpacing: '-0.03em',
      }}>
        {typeof value === 'number' ? (
          inView ? <Counter target={value} /> : '0'
        ) : value}
        {suffix}
      </div>
      <div style={{
        fontSize: '0.75rem',
        color: '#475569',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        fontFamily: "'JetBrains Mono', monospace",
      }}>{label}</div>
    </motion.div>
  );
};

/* ─── Landing Page ─────────────────────────────────────────────── */
export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });

  // Cursor glow only on hero
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, []);

  const verifications = [
    { addr: '0x7a3f...2b1c', type: 'KYC_COMPLETE', time: '2 min ago' },
    { addr: '0x9e2d...8f4a', type: 'AGE_VERIFIED', time: '5 min ago' },
    { addr: '0x1b5c...3d7e', type: 'ACCREDITED_INVESTOR', time: '8 min ago' },
    { addr: '0x4f2a...9c1b', type: 'AML_CLEAR', time: '11 min ago' },
    { addr: '0xd83e...2f5a', type: 'JURISDICTION_CLEAR', time: '14 min ago' },
    { addr: '0x2c9f...7e3d', type: 'KYC_COMPLETE', time: '17 min ago' },
  ];

  return (
    <main style={{ minHeight: '100vh' }}>
      {/* ── HERO ────────────────────────────────────────── */}
      <section
        ref={heroRef}
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 24px 80px',
          overflow: 'hidden',
        }}
      >
        {/* Cursor glow */}
        <div
          className="cursor-glow"
          style={{ left: cursorPos.x, top: cursorPos.y }}
        />

        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ marginBottom: '2rem' }}
          >
            <div className="hero-badge" style={{ display: 'inline-flex' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 8px rgba(0,240,255,0.8)' }} />
              HASHKEY CHAIN HORIZON HACKATHON
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(2.8rem, 7vw, 5rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.04em',
              color: 'white',
              marginBottom: '1.5rem',
            }}
          >
            Prove Your Identity
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00f0ff, #5b4fff, #f050f0)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'gradient-shift 4s ease infinite',
              textShadow: 'none',
              display: 'inline-block',
            }}>
              Without Leaking Data
            </span>
          </motion.h1>

          {/* Subheading with typing */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: '#64748b',
              maxWidth: 620,
              margin: '0 auto 2.5rem',
              lineHeight: 1.7,
              fontWeight: 400,
            }}
          >
            <TypingText
              text="The first privacy-preserving compliance layer for HashKey Chain. Zero-Knowledge proof technology meets regulatory standards."
              delay={28}
            />
          </motion.p>

          {/* CTA Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <Link href="/issue">
              <button className="btn-primary animate-pulse-glow" style={{ fontSize: '15px', padding: '14px 36px' }}>
                Get Started
                <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="/docs">
              <button className="btn-secondary" style={{ fontSize: '15px', padding: '14px 36px' }}>
                Read Documentation
              </button>
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            style={{
              marginTop: '3.5rem',
              display: 'flex',
              gap: '2rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {['ZK-SNARK Powered', 'On HashKey Chain', 'Non-Custodial'].map((t) => (
              <div key={t} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#475569',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,240,255,0.4)' }} />
                {t}
              </div>
            ))}
          </motion.div>

          {/* Shield visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.7, ease: [0.4, 0, 0.2, 1] }}
            style={{ marginTop: '5rem' }}
          >
            <ShieldVisual />
          </motion.div>
        </div>
      </section>

      {/* ── PROOF SELECTOR ──────────────────────────────── */}
      <section style={{ padding: '80px 24px 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '1rem',
              padding: '6px 16px', borderRadius: 100,
              background: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.2)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 8px #00f0ff' }} />
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700 }}>
                Step 01 — Choose Credential
              </span>
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 2.75rem)', color: 'white', letterSpacing: '-0.04em', marginBottom: '0.75rem' }}>
              Verify Your Identity
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Choose what to prove. Your private data never leaves your device — only a cryptographic proof goes on-chain.
            </p>
          </motion.div>
          <ProofSelector />
        </div>
      </section>

      {/* ── ZK BADGE ────────────────────────────────────── */}
      <section style={{ padding: '60px 24px 80px', position: 'relative', zIndex: 1,
        background: 'linear-gradient(180deg, transparent, rgba(0,240,255,0.015), transparent)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '1rem',
              padding: '6px 16px', borderRadius: 100,
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6' }} />
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700 }}>
                Step 02 — Identity Badge
              </span>
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 2.75rem)', color: 'white', letterSpacing: '-0.04em', marginBottom: '0.75rem' }}>
              Soulbound Credentials
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Every verified proof mints a non-transferable on-chain badge — your portable identity layer.
            </p>
          </motion.div>
          <ZKBadgeDisplay />
        </div>
      </section>

      {/* ── DEFI DEMO ────────────────────────────────────── */}
      <section style={{ padding: '60px 24px 100px', position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '1rem',
              padding: '6px 16px', borderRadius: 100,
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 700 }}>
                Step 03 — Access DeFi
              </span>
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 2.75rem)', color: 'white', letterSpacing: '-0.04em', marginBottom: '0.75rem' }}>
              See ZKGate in Action
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              A live lending pool that gates access with ZKGate. KYC-verified users get full access — everyone else sees a wall.
            </p>
          </motion.div>
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <DeFiDemo />
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link href="/defi-demo">
              <button className="btn-secondary" style={{ fontSize: 13, padding: '10px 28px' }}>
                <BarChart2 size={14} />
                Full DeFi Demo
                <ArrowRight size={13} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────── */}
      <section style={{ padding: '100px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '4rem' }}
          >
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              color: 'white',
              letterSpacing: '-0.03em',
              marginBottom: '1rem',
            }}>
              Why{' '}
              <span style={{
                background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>ZKGate</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 480, margin: '0 auto' }}>
              Privacy-first identity verification without compromising compliance.
            </p>
          </motion.div>

          <div className="features-grid">
            <FeatureCard
              icon={<Lock size={22} />}
              title="Totally Private"
              desc="Your data never leaves your device. Only cryptographic proof of attributes is shared on-chain."
              color="#00f0ff"
              delay={0}
            />
            <FeatureCard
              icon={<Zap size={22} />}
              title="Instant Verification"
              desc="Gas-optimized on HashKey Chain for near-instant compliance verification in under 2 seconds."
              color="#8b5cf6"
              delay={0.1}
            />
            <FeatureCard
              icon={<Shield size={22} />}
              title="Regulatory Grade"
              desc="Built to comply with global standards while preserving the Web3 ethos of privacy and self-sovereignty."
              color="#10b981"
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section style={{
        padding: '100px 24px',
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255,255,255,0.01)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: '5rem' }}
          >
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              color: 'white',
              letterSpacing: '-0.03em',
              marginBottom: '1rem',
            }}>How It Works</h2>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>Three steps to private, compliant DeFi access.</p>
          </motion.div>

          {/* Steps with connector lines */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '3rem',
            position: 'relative',
          }}>
            {/* Connector line (desktop only) */}
            <div style={{
              position: 'absolute',
              top: 24,
              left: '16.5%',
              right: '16.5%',
              height: 2,
              background: 'linear-gradient(90deg, #00f0ff, #8b5cf6, #f050f0)',
              borderRadius: 2,
              display: 'none',
            }} className="hidden md:block" />

            <Step n="1" title="Get Verified"
              desc="Complete KYC once with a trusted issuer. Your data stays with them, never on-chain."
              delay={0} />
            <Step n="2" title="Generate Proof"
              desc="When needed, generate a zero-knowledge proof that verifies your claim without revealing data."
              delay={0.1} />
            <Step n="3" title="Access DeFi"
              desc="Present your proof to any DeFi protocol on HashKey Chain. Instant, private, compliant access."
              delay={0.2} />
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────── */}
      <section style={{ padding: '100px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="stats-grid">
            <StatCard value={0} label="Personal Data On-Chain" suffix="" delay={0} />
            <StatCard value="< 2s" label="Proof Generation Time" delay={0.1} />
            <StatCard value={5} label="Credential Types" delay={0.2} />
            <StatCard value="∞" label="Possible Verifications" delay={0.3} />
          </div>
        </div>
      </section>

      {/* ── LIVE ACTIVITY TICKER ──────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1 }}>
        <div className="ticker-wrapper">
          {/* Live indicator */}
          <div style={{
            position: 'absolute',
            left: 24,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-dark)',
            paddingRight: 16,
          }}>
            <div style={{ position: 'relative', width: 8, height: 8 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                position: 'absolute',
              }} />
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                position: 'absolute',
                animation: 'ping-dot 1.5s ease-in-out infinite',
                opacity: 0.6,
              }} />
            </div>
            <span style={{
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#10b981',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>Live</span>
          </div>

          <div className="animate-ticker" style={{ display: 'flex', gap: '3rem', paddingLeft: '120px' }}>
            {[...verifications, ...verifications, ...verifications].map((v, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                whiteSpace: 'nowrap',
                fontSize: '12px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#475569',
              }}>
                <span>🔒</span>
                <span style={{ color: '#00f0ff' }}>{v.addr}</span>
                <span>verified</span>
                <span style={{
                  background: 'rgba(0,240,255,0.08)',
                  border: '1px solid rgba(0,240,255,0.15)',
                  color: '#00f0ff',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '10px',
                  fontWeight: 700,
                }}>{v.type}</span>
                <span style={{ color: '#334155' }}>— {v.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IMPOSSIBLE TRIANGLE ─────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1 }}>
        <ImpossibleTriangle />
      </section>

      {/* ── CTA SECTION ─────────────────────────────────── */}
      <section style={{
        padding: '120px 24px',
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        <div className="cta-orb" />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              letterSpacing: '-0.04em',
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, #00f0ff, #5b4fff, #f050f0)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'gradient-shift 4s ease infinite',
            }}>
              Ready to Build with ZKGate?
            </h2>
            <p style={{
              color: '#64748b',
              fontSize: '1.1rem',
              marginBottom: '2.5rem',
              lineHeight: 1.7,
            }}>
              Integrate privacy-preserving identity verification into your DeFi protocol in minutes.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/issue">
                <button className="btn-primary" style={{ fontSize: '15px', padding: '14px 36px' }}>
                  Start Building
                  <ArrowRight size={16} />
                </button>
              </Link>
              <a href="https://github.com/JMadhan1/zkgate" target="_blank" rel="noopener noreferrer">
                <button className="btn-secondary" style={{ fontSize: '15px', padding: '14px 32px' }}>
                  <Github size={16} />
                  View on GitHub
                </button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer style={{
        padding: '48px 24px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.3)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="20" viewBox="0 0 20 22" fill="none">
              <path d="M10 1L2 4.5V10C2 14.418 5.582 18.5 10 20C14.418 18.5 18 14.418 18 10V4.5L10 1Z"
                stroke="#00f0ff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
              <path d="M7 10.5L9 12.5L13 8.5" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              color: 'white',
              fontSize: '1rem',
              letterSpacing: '-0.02em',
            }}>ZK<span style={{ color: '#00f0ff' }}>Gate</span></span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { name: 'Docs', href: '/docs' },
              { name: 'GitHub', href: 'https://github.com/JMadhan1/zkgate' },
              { name: 'HashKey Chain', href: '#' },
              { name: 'DoraHacks', href: '#' },
            ].map((l) => (
              <Link key={l.name} href={l.href} style={{
                fontSize: '13px',
                color: '#475569',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#00f0ff')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#475569')}
              >{l.name}</Link>
            ))}
          </div>

          <p style={{
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#334155',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Built for HashKey Chain Horizon Hackathon 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
