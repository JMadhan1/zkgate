'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, TrendingUp, Wallet, ArrowDown, ShieldCheck, Copy, Check, AlertTriangle, Zap } from 'lucide-react';

/* ─── Syntax-highlighted code block ────────────────────────────── */
const CODE = `// Just 3 lines to integrate ZKGate
import {IZKGate} from "./interfaces/IZKGate.sol";

modifier onlyVerified(uint256 credType) {
    require(
        zkGate.hasAccess(msg.sender, credType),
        "Not verified"
    );
    _;
}

// That's it. Use it anywhere:
function deposit() external onlyVerified(3) {
    // Only KYC'd users reach here
}`;

type Token = { text: string; type: 'keyword' | 'string' | 'comment' | 'type' | 'function' | 'normal' | 'number' };

function tokenizeLine(line: string): Token[] {
  const keywords = ['import', 'modifier', 'require', 'function', 'external', 'uint256', 'pragma', 'contract'];
  const types = ['IZKGate', 'ZKGate'];

  if (line.trim().startsWith('//')) return [{ text: line, type: 'comment' }];

  const tokens: Token[] = [];
  let rest = line;
  while (rest.length > 0) {
    const kw = keywords.find((k) => rest.startsWith(k) && (rest.length === k.length || /\W/.test(rest[k.length])));
    if (kw) { tokens.push({ text: kw, type: 'keyword' }); rest = rest.slice(kw.length); continue; }
    const ty = types.find((t) => rest.startsWith(t));
    if (ty) { tokens.push({ text: ty, type: 'type' }); rest = rest.slice(ty.length); continue; }
    if (rest[0] === '"') {
      const end = rest.indexOf('"', 1);
      const s = end === -1 ? rest : rest.slice(0, end + 1);
      tokens.push({ text: s, type: 'string' }); rest = rest.slice(s.length); continue;
    }
    tokens.push({ text: rest[0], type: 'normal' }); rest = rest.slice(1);
  }
  return tokens;
}

const COLOR_MAP: Record<Token['type'], string> = {
  keyword:  '#c792ea',
  string:   '#c3e88d',
  comment:  '#546e7a',
  type:     '#ffcb6b',
  function: '#82aaff',
  number:   '#f78c6c',
  normal:   'rgba(0,240,255,0.8)',
};

const CodeSnippet = () => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const lines = CODE.split('\n');

  return (
    <div className="code-block" style={{ overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#ef4444', '#f59e0b', '#10b981'].map((c) => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
            ))}
          </div>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', marginLeft: 4 }}>
            IZKGate.sol
          </span>
        </div>
        <button
          className={`copy-btn ${copied ? 'copied' : ''}`}
          onClick={copy}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code */}
      <pre style={{
        padding: '20px 20px 20px 0',
        margin: 0,
        overflowX: 'auto',
        fontSize: '12px',
        lineHeight: 1.8,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex' }}>
            {/* Line number */}
            <span style={{
              minWidth: 44,
              textAlign: 'right',
              paddingRight: 16,
              color: '#1e293b',
              userSelect: 'none',
              fontSize: '11px',
            }}>{i + 1}</span>
            {/* Tokens */}
            <span>
              {tokenizeLine(line).map((tok, j) => (
                <span key={j} style={{ color: COLOR_MAP[tok.type] }}>{tok.text}</span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
};

/* ─── Scan line effect ──────────────────────────────────────────── */
const ScanLine = () => (
  <div className="scan-overlay" style={{ borderRadius: 16 }}>
    <style jsx>{`
      .scan-overlay::after {
        animation-duration: 2.5s;
      }
    `}</style>
  </div>
);

/* ─── Mock DeFi Pool Card ────────────────────────────────────────── */
const PoolCard = ({ unlocked }: { unlocked: boolean }) => {
  const [depositVal, setDepositVal] = useState('');

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div
        className="glass-card"
        style={{
          padding: '1.5rem',
          filter: unlocked ? 'none' : 'saturate(0.1)',
          opacity: unlocked ? 1 : 0.5,
          transition: 'all 0.6s ease',
        }}
      >
        {/* Pool header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: unlocked ? 'linear-gradient(135deg, #00f0ff, #8b5cf6)' : 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'background 0.5s ease',
            }}>💧</div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>HSK/USDT Pool</div>
              <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>HashKey DeFi v2</div>
            </div>
          </div>
          {unlocked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 100,
                padding: '4px 10px',
              }}
            >
              <ShieldCheck size={10} color="#10b981" />
              <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontWeight: 700 }}>Verified via ZKGate</span>
            </motion.div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'TVL', val: '$12.4M' },
            { label: 'APY', val: '8.2%' },
            { label: 'Balance', val: '1,000 USDT' },
          ].map(({ label, val }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              padding: '10px 12px',
              border: `1px solid ${unlocked ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
              transition: 'border-color 0.5s ease',
            }}>
              <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '1rem',
                color: unlocked ? (label === 'APY' ? '#10b981' : 'white') : '#1e293b',
                transition: 'color 0.5s ease',
              }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Deposit input */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${unlocked ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'border-color 0.5s ease',
            boxShadow: unlocked ? '0 0 0 0 rgba(0,240,255,0)' : 'none',
          }}>
            <input
              type="number"
              placeholder="0.00"
              value={depositVal}
              onChange={(e) => setDepositVal(e.target.value)}
              disabled={!unlocked}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '1.1rem',
                color: unlocked ? 'white' : '#1e293b',
                width: '100%',
                cursor: unlocked ? 'text' : 'not-allowed',
              }}
            />
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: unlocked ? '#64748b' : '#1e293b',
            }}>USDT</div>
          </div>
        </div>

        {/* Deposit button */}
        <button
          disabled={!unlocked}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 12,
            border: `1px solid ${unlocked ? 'transparent' : 'rgba(239,68,68,0.3)'}`,
            background: unlocked
              ? 'linear-gradient(135deg, #00f0ff, #5b4fff)'
              : 'rgba(239,68,68,0.05)',
            color: unlocked ? 'white' : '#ef4444',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            cursor: unlocked ? 'pointer' : 'not-allowed',
            transition: 'all 0.5s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {unlocked ? (
            <><Wallet size={15} /> Deposit</>
          ) : (
            <><Lock size={15} /> Identity Verification Required</>
          )}
        </button>
      </div>

      {/* Locked overlay */}
      {!unlocked && (
        <div className="locked-overlay">
          <ScanLine />
          <div style={{ textAlign: 'center', padding: '0 1.5rem', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: '#ef4444',
            }}>
              <Lock size={22} />
            </div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '1rem',
              color: 'white',
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em',
            }}>Identity Verification Required</div>
            <p style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.6 }}>
              This pool requires KYC verification via ZKGate to comply with regulatory standards.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────── */
export default function DeFiDemo() {
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 2000));
    setVerifying(false);
    setIsVerified(true);
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: 100, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', zIndex: 1 }}>
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
            DeFi Integration{' '}
            <span style={{
              background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Demo</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: 480, margin: '0 auto' }}>
            See how ZKGate protects DeFi protocols with zero-knowledge identity verification
          </p>
        </motion.div>

        {/* Split Screen */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem',
          alignItems: 'start',
        }}>
          {/* LEFT — Locked */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: '0.75rem',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isVerified ? '#10b981' : '#ef4444',
                boxShadow: isVerified ? '0 0 8px rgba(16,185,129,0.8)' : '0 0 8px rgba(239,68,68,0.8)',
                transition: 'all 0.5s ease',
              }} />
              <span style={{
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                color: isVerified ? '#10b981' : '#ef4444',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                transition: 'color 0.5s ease',
              }}>
                {isVerified ? 'Access Granted' : 'Access Locked'}
              </span>
            </div>
            <PoolCard unlocked={isVerified} />
          </motion.div>

          {/* CENTER — Verify button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.5rem',
              paddingTop: '4rem',
            }}
          >
            {/* Arrow icon */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 2,
                    height: 12,
                    borderRadius: 1,
                    background: isVerified ? '#10b981' : 'rgba(0,240,255,0.3)',
                    opacity: 1 - i * 0.25,
                    transition: 'background 0.5s ease',
                  }}
                />
              ))}
              <div style={{ color: isVerified ? '#10b981' : 'rgba(0,240,255,0.5)', transition: 'color 0.5s ease' }}>
                <ArrowDown size={20} />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!isVerified ? (
                <motion.button
                  key="verify"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={handleVerify}
                  disabled={verifying}
                  className="btn-primary animate-pulse-glow"
                  style={{
                    padding: '14px 28px',
                    fontSize: '14px',
                    flexDirection: 'column',
                    gap: 4,
                    minWidth: 180,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {verifying ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'ring-rotate 0.8s linear infinite' }} />
                        Verifying...
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={15} />
                        Verify with ZKGate
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.7, fontWeight: 400 }}>No data shared</div>
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.div
                  key="verified"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '14px 24px',
                    borderRadius: 12,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    minWidth: 160,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px' }}>
                    <Check size={16} />
                    Verified!
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>
                    via ZKGate
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{
              fontSize: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#334155',
              textAlign: 'center',
              maxWidth: 160,
              lineHeight: 1.6,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {isVerified ? 'Proof submitted on-chain. Access granted.' : 'Proof generated locally. No PII on-chain.'}
            </div>
          </motion.div>

          {/* RIGHT — Status panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: '0.75rem',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isVerified ? '#10b981' : '#f59e0b',
                boxShadow: isVerified ? '0 0 8px rgba(16,185,129,0.8)' : '0 0 8px rgba(245,158,11,0.8)',
                animation: 'ping-dot 1.5s ease-in-out infinite',
              }} />
              <span style={{
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#64748b',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}>Protocol Status</span>
            </div>

            {/* Status card */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'ZKGate Contract',   val: '0x7a3f...', ok: true },
                  { label: 'Merkle Root',        val: 'Synced ✓',   ok: true },
                  { label: 'User Verification',  val: isVerified ? 'PASS ✓' : 'PENDING', ok: isVerified },
                  { label: 'Pool Access',        val: isVerified ? 'UNLOCKED' : 'LOCKED', ok: isVerified },
                ].map(({ label, val, ok }) => (
                  <div key={label} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ fontSize: '12px', color: '#475569', fontFamily: "'Inter', sans-serif" }}>{label}</span>
                    <span style={{
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: ok ? '#10b981' : '#f59e0b',
                      fontWeight: 700,
                      transition: 'color 0.5s ease',
                    }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info box */}
            <div style={{
              background: 'rgba(0,240,255,0.04)',
              border: '1px solid rgba(0,240,255,0.12)',
              borderRadius: 12,
              padding: '1rem 1.25rem',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              <ShieldCheck size={16} color="#00f0ff" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>
                  Automated Compliance
                </div>
                <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
                  Non-interactive ZK proofs let users prove compliance without exposing personal data to the protocol.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Code integration snippet */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ maxWidth: 800, margin: '0 auto' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              fontWeight: 700,
              marginBottom: '0.5rem',
            }}>Integration</div>
            <h3 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '1.5rem',
              color: 'white',
              letterSpacing: '-0.03em',
              marginBottom: '0.5rem',
            }}>Three lines of code.</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              That&apos;s all it takes to add ZKGate compliance to any DeFi protocol.
            </p>
          </div>
          <CodeSnippet />
          <div style={{
            textAlign: 'center',
            marginTop: '1rem',
            fontSize: '13px',
            color: '#475569',
            fontStyle: 'italic',
          }}>
            That&apos;s it. Three lines. Full compliance. ✓
          </div>
        </motion.div>
      </div>
    </div>
  );
}
