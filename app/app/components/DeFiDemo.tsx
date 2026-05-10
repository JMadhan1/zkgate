'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { ShieldCheck, Lock, ArrowRight, TrendingUp, Wallet, Zap, Activity } from 'lucide-react';
import Link from 'next/link';

const POOL_ABI = [
  'function deposit(uint256 amount) external',
  'function borrow(uint256 amount) external',
  'function checkAccess(address user) view returns (bool)',
];

const POOL_STATS = [
  { label: 'TVL', val: '$12.4M', color: '#00f0ff' },
  { label: 'APY', val: '8.2%', color: '#10b981' },
  { label: 'Utilization', val: '74%', color: '#f59e0b' },
];

export function DeFiDemo() {
  const { address, isConnected } = useAccount();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txMsg, setTxMsg] = useState('');

  const poolAddress = process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS;

  const checkAccess = async () => {
    if (!address || !poolAddress) return;
    setChecking(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const contract = new ethers.Contract(poolAddress, POOL_ABI, provider);
      const ok: boolean = await contract.checkAccess(address);
      setHasAccess(ok);
    } catch {
      setHasAccess(false);
    } finally {
      setChecking(false);
    }
  };

  const callPool = async (action: 'deposit' | 'borrow') => {
    if (!poolAddress) return;
    setTxStatus('pending');
    setTxMsg('');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(poolAddress, POOL_ABI, signer);
      const tx = await contract[action](ethers.parseUnits('100', 6));
      await tx.wait();
      setTxStatus('success');
      setTxMsg(`${action === 'deposit' ? 'Deposit' : 'Borrow'} successful! Tx: ${tx.hash.slice(0, 18)}...`);
    } catch (err: any) {
      setTxStatus('error');
      const reason = err?.reason ?? err?.shortMessage ?? 'Transaction failed';
      setTxMsg(reason.includes('KYC') ? 'ZKGate: KYC verification required' : reason);
    }
  };

  const isVerified = hasAccess === true;

  return (
    <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden' }}>
      {/* Top accent line */}
      <div style={{
        height: 2,
        background: isVerified
          ? 'linear-gradient(90deg, transparent, #10b981, #00f0ff, transparent)'
          : 'linear-gradient(90deg, transparent, #8b5cf6, #00f0ff, transparent)',
      }} />

      <div style={{
        padding: '1.75rem',
        border: '1px solid rgba(255,255,255,0.07)',
        borderTop: 'none',
        borderRadius: '0 0 20px 20px',
        background: 'linear-gradient(135deg, rgba(0,240,255,0.03) 0%, rgba(5,5,16,0.97) 50%, rgba(139,92,246,0.03) 100%)',
        position: 'relative',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,240,255,0.05), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.div
              animate={{ boxShadow: ['0 0 0px rgba(0,240,255,0.3)', '0 0 20px rgba(0,240,255,0.3)', '0 0 0px rgba(0,240,255,0.3)'] }}
              transition={{ duration: 3, repeat: Infinity }}
              style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(0,240,255,0.12), rgba(139,92,246,0.12))',
                border: '1px solid rgba(0,240,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}
            >
              💧
            </motion.div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
                LendingPool Protocol
              </div>
              <div style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                ZK-gated · KYC Required
              </div>
            </div>
          </div>

          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 100,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}
          >
            <Activity size={10} color="#10b981" />
            <span style={{ fontSize: 11, color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
              8.2% APY
            </span>
          </motion.div>
        </div>

        {/* Access banner */}
        <AnimatePresence mode="wait">
          {hasAccess === true && (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              style={{
                padding: '0.875rem 1rem',
                borderRadius: 12, marginBottom: '1.25rem',
                background: 'rgba(16,185,129,0.07)',
                border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <ShieldCheck size={16} color="#10b981" />
              </motion.div>
              <div>
                <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                  ZKGate Verified — Full Access Granted
                </div>
                <div style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                  Identity proven without revealing personal data
                </div>
              </div>
            </motion.div>
          )}
          {hasAccess === false && (
            <motion.div
              key="no"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              style={{
                padding: '0.875rem 1rem',
                borderRadius: 12, marginBottom: '1.25rem',
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={15} color="#ef4444" />
                <div>
                  <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                    KYC Required
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                    Generate a ZK proof to unlock access
                  </div>
                </div>
              </div>
              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.35)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444', fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                  }}
                >
                  Verify <ArrowRight size={10} />
                </motion.button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pool stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {POOL_STATS.map(({ label, val, color }) => (
            <motion.div
              key={label}
              whileHover={{ y: -2 }}
              style={{
                padding: '0.875rem',
                background: `${color}06`,
                borderRadius: 12,
                border: `1px solid ${color}18`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 9, color: '#475569', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, fontWeight: 700 }}>
                {label}
              </div>
              <div style={{
                fontSize: 18, fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                background: `linear-gradient(135deg, white, ${color})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {val}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <motion.button
            onClick={() => callPool('deposit')}
            disabled={!isConnected || !isVerified}
            whileHover={isVerified ? { scale: 1.02, y: -1 } : {}}
            whileTap={isVerified ? { scale: 0.98 } : {}}
            style={{
              padding: '13px',
              borderRadius: 12,
              border: 'none',
              background: isVerified
                ? 'linear-gradient(135deg, #00f0ff, #5b4fff)'
                : 'rgba(255,255,255,0.03)',
              color: isVerified ? 'white' : '#475569',
              fontSize: 13, fontWeight: 700,
              cursor: isVerified ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: isVerified ? '0 4px 20px rgba(0,240,255,0.25)' : 'none',
            } as React.CSSProperties}
          >
            <Wallet size={14} /> Deposit
          </motion.button>
          <motion.button
            onClick={() => callPool('borrow')}
            disabled={!isConnected || !isVerified}
            whileHover={isVerified ? { scale: 1.02, y: -1 } : {}}
            whileTap={isVerified ? { scale: 0.98 } : {}}
            style={{
              padding: '13px',
              borderRadius: 12,
              border: isVerified ? '1px solid rgba(0,240,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
              background: isVerified ? 'rgba(0,240,255,0.07)' : 'rgba(255,255,255,0.03)',
              color: isVerified ? '#00f0ff' : '#475569',
              fontSize: 13, fontWeight: 700,
              cursor: isVerified ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <TrendingUp size={14} /> Borrow
          </motion.button>
        </div>

        {/* Check access / connect prompt */}
        {!isConnected ? (
          <div style={{
            textAlign: 'center', padding: '0.875rem',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            fontSize: 12, color: '#475569', fontFamily: "'JetBrains Mono', monospace",
          }}>
            Connect wallet to interact with the pool
          </div>
        ) : hasAccess === null ? (
          <motion.button
            onClick={checkAccess}
            disabled={checking}
            whileHover={!checking ? { scale: 1.01 } : {}}
            whileTap={!checking ? { scale: 0.99 } : {}}
            style={{
              width: '100%', padding: '11px',
              borderRadius: 10,
              border: '1px solid rgba(0,240,255,0.2)',
              background: 'rgba(0,240,255,0.04)',
              color: '#00f0ff', fontSize: 12, cursor: checking ? 'default' : 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {checking ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 12, height: 12, border: '2px solid rgba(0,240,255,0.2)', borderTopColor: '#00f0ff', borderRadius: '50%' }}
                />
                Checking ZKGate access...
              </>
            ) : (
              <>
                <Zap size={12} /> Check My ZK Access
              </>
            )}
          </motion.button>
        ) : null}

        {/* Tx status */}
        <AnimatePresence>
          {txStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                marginTop: '0.875rem',
                padding: '0.875rem',
                borderRadius: 10,
                background: txStatus === 'success'
                  ? 'rgba(16,185,129,0.07)'
                  : txStatus === 'error'
                  ? 'rgba(239,68,68,0.07)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${txStatus === 'success' ? 'rgba(16,185,129,0.2)' : txStatus === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                color: txStatus === 'success' ? '#10b981' : txStatus === 'error' ? '#ef4444' : '#64748b',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {txStatus === 'pending' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 12, height: 12, border: '2px solid rgba(100,116,139,0.3)', borderTopColor: '#64748b', borderRadius: '50%', flexShrink: 0 }}
                />
              )}
              {txStatus === 'pending' ? 'Broadcasting transaction...' : txMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ZK shield watermark */}
        <div style={{
          position: 'absolute', bottom: 16, right: 20,
          fontSize: 32, opacity: 0.04, pointerEvents: 'none', userSelect: 'none',
        }}>
          🛡️
        </div>
      </div>
    </div>
  );
}
