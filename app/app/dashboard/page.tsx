'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { Activity, ShieldCheck, AlertTriangle, Layers, RefreshCw } from 'lucide-react';

const ZKGATE_ABI = [
  'event VerificationCompleted(address indexed user, uint8 credType, bytes32 nullifier)',
  'event NullifierUsed(bytes32 indexed nullifier, address indexed user)',
  'event AccessGranted(address indexed user, uint8 credType, uint256 expiry)',
];

const REGISTRY_ABI = [
  'function getStats() view returns (uint256 issued, uint256 revoked, bytes32 currentRoot)',
];

const CRED_NAMES: Record<number, string> = {
  0: 'AGE_VERIFIED',
  1: 'ACCREDITED_INVESTOR',
  2: 'JURISDICTION_CLEAR',
  3: 'KYC_COMPLETE',
  4: 'AML_CLEAR',
};

const CRED_COLORS: Record<number, string> = {
  0: '#8b5cf6',
  1: '#f59e0b',
  2: '#06b6d4',
  3: '#10b981',
  4: '#00f0ff',
};

interface ActivityItem {
  wallet: string;
  credType: number;
  timestamp: number;
  txHash: string;
}

interface Stats {
  proofsVerified: number;
  credentialsIssued: number;
  replayBlocked: number;
  dappIntegrations: number;
}

const REFRESH_INTERVAL = 15_000;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://hashkeychain-testnet.alt.technology';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ proofsVerified: 0, credentialsIssued: 0, replayBlocked: 0, dappIntegrations: 1 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const zkgateAddress = process.env.NEXT_PUBLIC_ZKGATE_ADDRESS;
  const registryAddress = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;

  const fetchData = useCallback(async () => {
    if (!zkgateAddress) {
      setError('NEXT_PUBLIC_ZKGATE_ADDRESS not configured');
      setLoading(false);
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const zkGate = new ethers.Contract(zkgateAddress, ZKGATE_ABI, provider);

      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 2_000);

      // Fetch events in parallel
      const [verifiedLogs, nullifierLogs, grantedLogs] = await Promise.all([
        zkGate.queryFilter(zkGate.filters.VerificationCompleted(), fromBlock),
        zkGate.queryFilter(zkGate.filters.NullifierUsed(), fromBlock),
        zkGate.queryFilter(zkGate.filters.AccessGranted(), fromBlock),
      ]);

      // Registry stats
      let credentialsIssued = 0;
      if (registryAddress) {
        try {
          const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
          const [issued] = await registry.getStats();
          credentialsIssued = Number(issued);
        } catch {}
      }

      // Build activity feed from last 10 VerificationCompleted events
      const recentLogs = verifiedLogs.slice(-10).reverse();
      const uniqueBlocks = [...new Set(recentLogs.map((l) => l.blockNumber))];
      const blockMap = new Map(
        await Promise.all(uniqueBlocks.map(async (n) => [n, await provider.getBlock(n)] as const))
      );
      const items: ActivityItem[] = recentLogs.map((log) => {
        const block = blockMap.get(log.blockNumber);
        const args = (log as any).args;
        return {
          wallet: args?.user ?? '0x????',
          credType: Number(args?.credType ?? 0),
          timestamp: Number(block?.timestamp ?? 0),
          txHash: log.transactionHash,
        };
      });

      setStats({
        proofsVerified: verifiedLogs.length,
        credentialsIssued: credentialsIssued || grantedLogs.length,
        replayBlocked: nullifierLogs.length,
        dappIntegrations: 1,
      });
      setActivity(items);
      setLastUpdate(new Date());
      setError('');
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load on-chain data. Check RPC connection.');
    } finally {
      setLoading(false);
    }
  }, [zkgateAddress, registryAddress]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const StatCard = ({ icon, label, value, color, delay }: {
    icon: React.ReactNode; label: string; value: number | string; color: string; delay: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, type: 'spring', stiffness: 200 }}
      whileHover={{ y: -4, boxShadow: `0 20px 40px rgba(0,0,0,0.4), 0 0 30px ${color}15` }}
      className="glass-card card-gradient-top"
      style={{ padding: '1.5rem', cursor: 'default', transition: 'box-shadow 0.3s ease', position: 'relative', overflow: 'hidden' }}
    >
      {/* Background glow */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, ${color}12, transparent 70%)`, pointerEvents: 'none' }} />

      <motion.div
        animate={{ boxShadow: [`0 0 0px ${color}40`, `0 0 20px ${color}40`, `0 0 0px ${color}40`] }}
        transition={{ duration: 3, repeat: Infinity, delay }}
        style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}14`, border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, marginBottom: '1.25rem',
        }}
      >
        {icon}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.3 }}
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(1.75rem, 3vw, 2.75rem)',
          fontWeight: 700, letterSpacing: '-0.04em', marginBottom: 6,
          background: `linear-gradient(135deg, white, ${color})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
        {loading ? '—' : value}
      </motion.div>
      <div style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
        {label}
      </div>
    </motion.div>
  );

  return (
    <div style={{ minHeight: '100vh', paddingTop: 100, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              color: 'white',
              letterSpacing: '-0.04em',
              marginBottom: '0.5rem',
            }}>
              Protocol{' '}
              <span style={{ background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Dashboard
              </span>
            </h1>
            <p style={{ color: '#475569', fontSize: '0.9rem' }}>Real-time on-chain analytics for ZKGate protocol</p>
          </motion.div>

          {/* Live indicator + refresh */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 100,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px rgba(16,185,129,0.8)',
                animation: 'pulse-live 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 11, color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                Live on HashKey Chain
              </span>
            </div>
            <button
              onClick={fetchData}
              title="Refresh"
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#64748b', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </motion.div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '0.875rem 1.25rem', borderRadius: 12, marginBottom: '1.5rem',
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: '#ef4444',
          }}>
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <StatCard icon={<ShieldCheck size={18} />} label="Total Proofs Verified" value={stats.proofsVerified} color="#00f0ff" delay={0} />
          <StatCard icon={<Layers size={18} />} label="Credentials Issued" value={stats.credentialsIssued} color="#8b5cf6" delay={0.1} />
          <StatCard icon={<AlertTriangle size={18} />} label="Replay Attacks Blocked" value={stats.replayBlocked} color="#ef4444" delay={0.2} />
          <StatCard icon={<Activity size={18} />} label="Active dApp Integrations" value={stats.dappIntegrations} color="#10b981" delay={0.3} />
        </div>

        {/* Activity feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card"
          style={{ padding: '1.5rem' }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1.25rem',
          }}>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: '1rem', color: 'white',
            }}>
              Recent Activity
            </div>
            {lastUpdate && (
              <div style={{ fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                Updated {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{
                  height: 44, borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  animation: `shimmer 1.5s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
              No recent verification events found in the last 10,000 blocks.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activity.map((item, i) => {
                const color = CRED_COLORS[item.credType] ?? '#64748b';
                const timeAgo = Math.floor((Date.now() / 1000 - item.timestamp) / 60);
                return (
                  <motion.div
                    key={`${item.txHash}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem 1rem', borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      gap: '0.75rem', flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: color, boxShadow: `0 0 6px ${color}80`, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12, color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.wallet.slice(0, 6)}...{item.wallet.slice(-4)}
                      </span>
                      <span style={{ fontSize: 12, color: '#475569' }}>verified</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      <div style={{
                        padding: '2px 8px', borderRadius: 4,
                        background: `${color}12`, border: `1px solid ${color}25`,
                        fontSize: 10, color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                      }}>
                        {CRED_NAMES[item.credType] ?? 'UNKNOWN'}
                      </div>
                      <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                        {timeAgo < 1 ? 'just now' : `${timeAgo}m ago`}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <style>{`
        @keyframes pulse-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
