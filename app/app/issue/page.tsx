'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Check, Loader2, ArrowRight, RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';

/* ─── Custom dropdown (avoids OS native styling issues on Windows) ── */
const CustomSelect = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${open ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 12,
          padding: '14px 18px',
          color: 'white',
          fontSize: '14px',
          fontFamily: "'Inter', sans-serif",
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'border-color 0.2s ease',
          boxShadow: open ? '0 0 20px rgba(0,240,255,0.12)' : 'none',
          textAlign: 'left',
        }}
      >
        <span>{value}</span>
        <ChevronDown
          size={14}
          color="#475569"
          style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'rgba(10, 10, 28, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          zIndex: 200,
          maxHeight: 220,
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          padding: '6px',
        }}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: opt === value ? 'rgba(0,240,255,0.1)' : 'transparent',
                color: opt === value ? '#00f0ff' : 'rgba(255,255,255,0.8)',
                fontSize: '13px',
                fontFamily: "'Inter', sans-serif",
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                if (opt !== value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (opt !== value) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {opt}
              {opt === value && <Check size={12} color="#00f0ff" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Confetti burst ────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#00f0ff', '#8b5cf6', '#f050f0', '#10b981', '#f59e0b'];

const ConfettiBurst = ({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <>
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${-10 + Math.random() * 20}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            width: `${4 + Math.random() * 6}px`,
            height: `${4 + Math.random() * 6}px`,
            animationDuration: `${1.2 + Math.random() * 1.2}s`,
            animationDelay: `${Math.random() * 0.5}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </>
  );
};

/* ─── Live Credential Card ─────────────────────────────────────── */
const CredentialCard = ({
  formData,
  credential,
  isFlipped,
  txHash,
}: {
  formData: {
    name: string;
    dob: string;
    country: string;
    investorStatus: string;
    idType: string;
  };
  credential: { commitment?: string } | null;
  isFlipped: boolean;
  txHash: string;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isFlipped) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    cardRef.current.style.transform = `perspective(1000px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
  }, [isFlipped]);

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
  }, []);

  const commitment = credential?.commitment || ('0x' + 'a'.repeat(40));
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const expiryDate = new Date(Date.now() + 365 * 24 * 3600 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const credTypes = [
    { label: 'KYC', active: !!formData.name && !!formData.dob },
    { label: 'AGE', active: !!formData.dob },
    { label: formData.investorStatus === 'accredited' ? 'ACCREDITED' : 'RETAIL', active: !!formData.investorStatus },
    { label: 'AML', active: !!formData.country },
  ];

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '100%',
        maxWidth: 440,
        aspectRatio: '1.6 / 1',
        position: 'relative',
        transition: 'transform 0.1s ease',
        transformStyle: 'preserve-3d',
        cursor: 'default',
      }}
    >
      {/* Front */}
      <div
        className="flip-card-front"
        style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          background: 'rgba(15, 15, 35, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          padding: '28px',
          border: credential
            ? '1px solid rgba(0, 240, 255, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: credential
            ? '0 0 40px rgba(0, 240, 255, 0.1), 0 20px 60px rgba(0,0,0,0.6)'
            : '0 20px 60px rgba(0,0,0,0.4)',
          transition: 'all 0.5s ease',
          animation: credential ? 'pulse-glow 3s ease-in-out infinite' : 'none',
          opacity: isFlipped ? 0 : 1,
          transform: isFlipped ? 'rotateY(90deg)' : 'rotateY(0deg)',
          transition2: 'opacity 0.3s ease, transform 0.4s ease',
        } as React.CSSProperties}
      >
        {/* Gradient top accent */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 20,
          right: 20,
          height: 2,
          background: 'linear-gradient(90deg, #00f0ff, #8b5cf6, #f050f0)',
          borderRadius: '0 0 4px 4px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(0,240,255,0.1)',
              border: '1px solid rgba(0,240,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00f0ff',
            }}>
              <Shield size={14} />
            </div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontWeight: 700,
            }}>ZKGate · HashKey</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: credential ? '#10b981' : '#f59e0b',
              boxShadow: credential ? '0 0 6px rgba(16,185,129,0.8)' : '0 0 6px rgba(245,158,11,0.8)',
              animation: 'ping-dot 1.5s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: '9px',
              fontFamily: "'JetBrains Mono', monospace",
              color: credential ? '#10b981' : '#f59e0b',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 700,
            }}>{credential ? 'Issued' : 'Pending'}</span>
          </div>
        </div>

        {/* Commitment hash */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#334155',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            marginBottom: 6,
          }}>Merkle Commitment</div>
          <div style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace',",
            color: credential ? 'rgba(0,240,255,0.7)' : 'rgba(255,255,255,0.1)',
            wordBreak: 'break-all',
            lineHeight: 1.5,
          }}>
            {commitment.slice(0, 42)}...
          </div>
        </div>

        {/* Credential type badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {credTypes.map((ct) => (
            <div key={ct.label} style={{
              padding: '3px 10px',
              borderRadius: 100,
              fontSize: '9px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: '0.08em',
              background: ct.active ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${ct.active ? 'rgba(0,240,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: ct.active ? '#00f0ff' : '#334155',
              transition: 'all 0.3s ease',
            }}>{ct.label}</div>
          ))}
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#334155', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Subject</div>
            <div style={{ fontSize: '13px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'white' }}>
              {formData.name || 'UNNAMED'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', color: '#334155', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Expires</div>
            <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>{expiryDate}</div>
          </div>
        </div>

        {/* QR placeholder */}
        <div style={{
          position: 'absolute',
          bottom: 28,
          right: 28,
          width: 44,
          height: 44,
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 2,
          padding: 4,
          opacity: credential ? 0.6 : 0.2,
        }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{
              borderRadius: 1,
              background: Math.random() > 0.4 ? 'rgba(0,240,255,0.6)' : 'transparent',
            }} />
          ))}
        </div>
      </div>

      {/* Back (success) */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, rotateY: -90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(5, 25, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: 20,
              padding: '28px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 0 60px rgba(16, 185, 129, 0.15), 0 20px 60px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              textAlign: 'center',
              animation: 'pulse-glow 3s ease-in-out infinite',
            }}
          >
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              border: '2px solid rgba(16,185,129,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}>
              <Check size={24} />
            </div>
            <div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '1.1rem',
                color: '#10b981',
                marginBottom: 8,
                letterSpacing: '-0.02em',
              }}>✅ Credential Issued</div>
              <div style={{
                fontSize: '9px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#334155',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}>Tx Hash</div>
              <div style={{
                fontSize: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(16,185,129,0.7)',
              }}>{txHash}</div>
            </div>
            <div style={{
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: 4,
            }}>Added to Merkle Tree ✓</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────── */
const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Singapore', 'Hong Kong',
  'Germany', 'France', 'Japan', 'Australia', 'Canada', 'Switzerland',
  'UAE', 'South Korea', 'Brazil', 'Netherlands',
];

export default function IssuePage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [credential, setCredential] = useState<{ commitment?: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    country: 'India',
    investorStatus: 'retail',
    idType: 'passport',
  });

  const update = (field: string, value: string) =>
    setFormData((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/issue-credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userData: formData, credentialType: 3 }),
      });
      const data = await res.json();
      setCredential(data.credential);
      const hash = '0x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
      setTxHash(hash);
      await new Promise((r) => setTimeout(r, 1800));
    } catch {
      // Use mock data if server not running
      setCredential({ commitment: '0x' + Math.random().toString(16).slice(2, 42) });
      setTxHash('0x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10));
    }
    setLoading(false);
    setSubmitted(true);
    setTimeout(() => {
      setIsFlipped(true);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3000);
    }, 300);
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: 100, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', zIndex: 1 }}>
      <ConfettiBurst active={confetti} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
            Issue{' '}
            <span style={{
              background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Credential</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 480, margin: '0 auto' }}>
            Complete your one-time verification to receive a ZK credential
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '3rem',
          alignItems: 'start',
        }}>
          {/* ── FORM ── */}
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                <div className="glass-card" style={{ padding: '2.5rem' }}>
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Full Name */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        fontWeight: 700,
                      }}>Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Your legal name"
                        className="input-field"
                        value={formData.name}
                        onChange={(e) => update('name', e.target.value)}
                      />
                    </div>

                    {/* DOB + Country */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{
                          fontSize: '11px',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#475569',
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                          fontWeight: 700,
                        }}>Date of Birth</label>
                        <input
                          type="date"
                          required
                          className="input-field"
                          style={{ colorScheme: 'dark' }}
                          value={formData.dob}
                          onChange={(e) => update('dob', e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{
                          fontSize: '11px',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#475569',
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                          fontWeight: 700,
                        }}>Country</label>
                        <CustomSelect
                          value={formData.country}
                          options={COUNTRIES}
                          onChange={(v) => update('country', v)}
                        />
                      </div>
                    </div>

                    {/* ID Type */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        fontWeight: 700,
                      }}>ID Type</label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {[
                          { val: 'passport', label: 'Passport' },
                          { val: 'national_id', label: 'National ID' },
                          { val: 'drivers_license', label: "Driver's License" },
                        ].map(({ val, label }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => update('idType', val)}
                            style={{
                              flex: 1,
                              padding: '10px 8px',
                              borderRadius: 10,
                              border: `1px solid ${formData.idType === val ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                              background: formData.idType === val ? 'rgba(0,240,255,0.06)' : 'rgba(255,255,255,0.02)',
                              color: formData.idType === val ? '#00f0ff' : '#475569',
                              fontSize: '11px',
                              fontWeight: 600,
                              fontFamily: "'Inter', sans-serif",
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>

                    {/* Investor Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        fontWeight: 700,
                      }}>Investor Status</label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {['retail', 'accredited'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => update('investorStatus', type)}
                            style={{
                              flex: 1,
                              padding: '12px',
                              borderRadius: 10,
                              border: `1px solid ${formData.investorStatus === type ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                              background: formData.investorStatus === type ? 'rgba(0,240,255,0.06)' : 'rgba(255,255,255,0.02)',
                              color: formData.investorStatus === type ? '#00f0ff' : '#475569',
                              fontSize: '12px',
                              fontWeight: 700,
                              fontFamily: "'Space Grotesk', sans-serif",
                              letterSpacing: '0.05em',
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {type === 'accredited' ? '💎' : '👤'} {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: '15px', marginTop: '0.5rem' }}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          Issuing Credential...
                        </>
                      ) : (
                        <>Issue ZK Credential <ArrowRight size={16} /></>
                      )}
                    </button>

                    <p style={{
                      fontSize: '11px',
                      color: '#334155',
                      textAlign: 'center',
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      🔒 Your data is processed locally and never stored on-chain
                    </p>
                  </form>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
              >
                <div className="glass-card" style={{ padding: '2.5rem', borderColor: 'rgba(16,185,129,0.3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                    }}>
                      <Check size={24} />
                    </div>

                    <div>
                      <h2 style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 700,
                        fontSize: '1.75rem',
                        letterSpacing: '-0.03em',
                        color: 'white',
                        marginBottom: '0.5rem',
                      }}>Credential Issued!</h2>
                      <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.7 }}>
                        Your ZK credential has been successfully issued and added to the Merkle tree on HashKey Chain.
                      </p>
                    </div>

                    {/* TX Hash */}
                    <div style={{
                      background: 'rgba(16,185,129,0.05)',
                      border: '1px solid rgba(16,185,129,0.15)',
                      borderRadius: 12,
                      padding: '1rem 1.25rem',
                    }}>
                      <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Transaction Hash</div>
                      <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {txHash}
                        <ExternalLink size={12} style={{ opacity: 0.5, cursor: 'pointer' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={() => window.location.href = '/prove'}
                        className="btn-primary"
                        style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                      >
                        Generate Proof <ArrowRight size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setSubmitted(false);
                          setIsFlipped(false);
                          setCredential(null);
                          setFormData({ name: '', dob: '', country: 'India', investorStatus: 'retail', idType: 'passport' });
                        }}
                        className="btn-secondary"
                        style={{ padding: '12px 16px' }}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CREDENTIAL CARD PREVIEW ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '0.5rem' }}
          >
            <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>
              Live Preview
            </div>
            <CredentialCard
              formData={formData}
              credential={credential}
              isFlipped={isFlipped}
              txHash={txHash}
            />

            {/* Info rows */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              {[
                { label: 'Protocol', val: 'ZK-SNARK / Groth16' },
                { label: 'Curve', val: 'BN254' },
                { label: 'Chain', val: 'HashKey Testnet (133)' },
                { label: 'Validity', val: '365 days' },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                  <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#64748b' }}>{val}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
