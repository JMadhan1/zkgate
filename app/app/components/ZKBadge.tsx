'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Clock, Zap, AlertTriangle } from 'lucide-react';

const BADGE_ABI = [
  'function getBadge(address user, uint8 credType) view returns (bool exists, uint8 ctype, uint256 validUntil, uint256 issuedAt)',
];

const CRED_LABELS: Record<number, { label: string; icon: string; color: string; glow: string }> = {
  0: { label: 'Age Verified',        icon: '🎂', color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' },
  1: { label: 'Accredited Investor', icon: '💼', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
  2: { label: 'Jurisdiction Clear',  icon: '🌍', color: '#06b6d4', glow: 'rgba(6,182,212,0.4)'  },
  3: { label: 'KYC Complete',        icon: '🪪', color: '#10b981', glow: 'rgba(16,185,129,0.4)' },
  4: { label: 'AML Clear',           icon: '🛡️', color: '#00f0ff', glow: 'rgba(0,240,255,0.4)'  },
};

interface BadgeInfo { credType: number; validUntil: number; issuedAt: number; isValid: boolean; }

/* ── Holographic shimmer card ─────────────────────────────────── */
function BadgeCard({ badge, index }: { badge: BadgeInfo; index: number }) {
  const meta = CRED_LABELS[badge.credType] ?? { label: 'Unknown', icon: '?', color: '#475569', glow: 'transparent' };
  const daysLeft = Math.max(0, Math.floor((badge.validUntil - Date.now() / 1000) / 86400));
  const pct = Math.min(100, Math.round((daysLeft / 365) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.12, type: 'spring', stiffness: 200, damping: 22 }}
      whileHover={{ y: -8, scale: 1.03 }}
      style={{
        position: 'relative', borderRadius: 20, overflow: 'hidden',
        minWidth: 200, flex: '1 1 200px', cursor: 'default',
        background: badge.isValid
          ? `linear-gradient(135deg, ${meta.color}14 0%, rgba(5,5,16,0.9) 50%, ${meta.color}08 100%)`
          : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(5,5,16,0.9))',
        border: `1px solid ${badge.isValid ? meta.color + '45' : 'rgba(239,68,68,0.3)'}`,
        boxShadow: badge.isValid ? `0 0 40px ${meta.glow}, 0 12px 40px rgba(0,0,0,0.4)` : '0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Holographic sweep animation */}
      {badge.isValid && (
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
          style={{
            position: 'absolute', top: 0, left: 0, width: '35%', height: '100%',
            background: `linear-gradient(105deg, transparent 40%, ${meta.color}20 50%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Top gradient bar */}
      <div style={{
        height: 3,
        background: badge.isValid
          ? `linear-gradient(90deg, transparent, ${meta.color}, ${meta.color}80, transparent)`
          : 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)',
      }} />

      <div style={{ padding: '1.5rem' }}>
        {/* Status dot */}
        <div style={{ position: 'absolute', top: 18, right: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div
            animate={badge.isValid ? { opacity: [1, 0.3, 1], scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: badge.isValid ? '#10b981' : '#ef4444',
              boxShadow: badge.isValid ? '0 0 10px rgba(16,185,129,0.9)' : '0 0 8px rgba(239,68,68,0.7)',
            }}
          />
          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: badge.isValid ? '#10b981' : '#ef4444' }}>
            {badge.isValid ? 'ACTIVE' : 'EXPIRED'}
          </span>
        </div>

        {/* Icon */}
        <motion.div
          animate={badge.isValid ? { boxShadow: [`0 0 12px ${meta.glow}`, `0 0 28px ${meta.glow}`, `0 0 12px ${meta.glow}`] } : {}}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            width: 56, height: 56, borderRadius: 16, marginBottom: '1rem',
            background: badge.isValid ? `${meta.color}18` : 'rgba(239,68,68,0.08)',
            border: `1px solid ${badge.isValid ? meta.color + '40' : 'rgba(239,68,68,0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}
        >
          {meta.icon}
        </motion.div>

        {/* Label */}
        <div style={{ fontSize: 15, fontWeight: 700, color: 'white', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4, letterSpacing: '-0.02em' }}>
          {meta.label}
        </div>

        {/* Validity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1.25rem',
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          color: badge.isValid ? meta.color : '#ef4444' }}>
          {badge.isValid ? <><ShieldCheck size={12} /> Valid · {daysLeft}d remaining</> : <><Clock size={12} /> Expired</>}
        </div>

        {/* Validity bar */}
        {badge.isValid && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: '#475569', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Validity</span>
              <span style={{ fontSize: 9, color: meta.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, delay: index * 0.12 + 0.3, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          paddingTop: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date(badge.issuedAt * 1000).toLocaleDateString()}
          </span>
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 100,
            background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.15)',
            color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
          }}>SOULBOUND</span>
        </div>
      </div>
    </motion.div>
  );
}

export function ZKBadgeDisplay() {
  const { address, isConnected } = useAccount();
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const badgeAddress = process.env.NEXT_PUBLIC_ZKBADGE_ADDRESS;

  useEffect(() => {
    if (!isConnected || !address || !badgeAddress) return;
    setLoading(true);
    (async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const contract = new ethers.Contract(badgeAddress, BADGE_ABI, provider);
        const found: BadgeInfo[] = [];
        for (let i = 0; i < 5; i++) {
          const [exists, ctype, validUntil, issuedAt] = await contract.getBadge(address, i);
          if (exists) found.push({ credType: Number(ctype), validUntil: Number(validUntil), issuedAt: Number(issuedAt), isValid: Number(validUntil) > Math.floor(Date.now() / 1000) });
        }
        setBadges(found);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [address, isConnected, badgeAddress]);

  if (!isConnected || !badgeAddress) return null;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '2.5rem',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        style={{ width: 18, height: 18, border: '2px solid rgba(0,240,255,0.3)', borderTopColor: '#00f0ff', borderRadius: '50%' }} />
      <span style={{ fontSize: 13, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>Loading your identity badges...</span>
    </div>
  );

  if (badges.length === 0) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ padding: '2rem', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <AlertTriangle size={20} color="#ef4444" />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>No ZK Badges Yet</div>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>Generate a proof above to mint your soulbound identity badge on HashKey Chain.</div>
      </div>
    </motion.div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
        <Zap size={14} color="#00f0ff" />
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>
          Your ZK Identity Badges
        </span>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(0,240,255,0.3), transparent)' }} />
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>{badges.length} credential{badges.length > 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {badges.map((badge, i) => <BadgeCard key={badge.credType} badge={badge} index={i} />)}
      </div>
    </div>
  );
}
