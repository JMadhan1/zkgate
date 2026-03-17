'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Search, Filter, ArrowUpRight, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

/* ─── Mock data ─────────────────────────────────────────────────── */
const AREA_DATA = [
  { day: 'Mar 1',  verifications: 45  },
  { day: 'Mar 5',  verifications: 82  },
  { day: 'Mar 8',  verifications: 67  },
  { day: 'Mar 11', verifications: 134 },
  { day: 'Mar 14', verifications: 98  },
  { day: 'Mar 17', verifications: 187 },
  { day: 'Mar 20', verifications: 143 },
  { day: 'Mar 23', verifications: 219 },
  { day: 'Mar 26', verifications: 178 },
  { day: 'Mar 29', verifications: 256 },
  { day: 'Apr 1',  verifications: 203 },
  { day: 'Apr 4',  verifications: 312 },
  { day: 'Apr 7',  verifications: 275 },
  { day: 'Apr 10', verifications: 389 },
];

const PIE_DATA = [
  { name: 'KYC_COMPLETE',        value: 40, color: '#00f0ff' },
  { name: 'AGE_VERIFIED',        value: 25, color: '#8b5cf6' },
  { name: 'JURISDICTION_CLEAR',  value: 20, color: '#f050f0' },
  { name: 'ACCREDITED_INVESTOR', value: 10, color: '#10b981' },
  { name: 'AML_CLEAR',           value: 5,  color: '#f59e0b' },
];

const CRED_TYPES = ['KYC_COMPLETE', 'AGE_VERIFIED', 'JURISDICTION_CLEAR', 'ACCREDITED_INVESTOR', 'AML_CLEAR'] as const;
const CRED_COLORS: Record<string, string> = {
  KYC_COMPLETE: '#00f0ff', AGE_VERIFIED: '#8b5cf6',
  JURISDICTION_CLEAR: '#f050f0', ACCREDITED_INVESTOR: '#10b981', AML_CLEAR: '#f59e0b',
};

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    tx: '0x' + Math.random().toString(16).slice(2, 12),
    prover: '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(2, 6),
    type: CRED_TYPES[i % CRED_TYPES.length],
    time: `${i * 2 + 1}m ago`,
  }));
}
const ALL_ROWS = makeRows(50);

/* ─── Animated counter ──────────────────────────────────────────── */
const Counter = ({ target }: { target: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let v = 0;
    const step = Math.ceil(target / 50);
    const id = setInterval(() => {
      v += step;
      if (v >= target) { setVal(target); clearInterval(id); }
      else setVal(v);
    }, 30);
    return () => clearInterval(id);
  }, [inView, target]);
  return <div ref={ref}>{val.toLocaleString()}</div>;
};

/* ─── Custom tooltips ────────────────────────────────────────────── */
const AreaTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(5,5,16,0.95)',
      border: '1px solid rgba(0,240,255,0.2)',
      borderRadius: 10,
      padding: '10px 14px',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#00f0ff' }}>
        {payload[0].value}
        <span style={{ fontSize: '11px', color: '#475569', fontWeight: 400, marginLeft: 4 }}>verifications</span>
      </div>
    </div>
  );
};

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(5,5,16,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#64748b' }}>{payload[0].name}</div>
      <div style={{ fontSize: '1.1rem', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: CRED_COLORS[payload[0].name] || 'white' }}>
        {payload[0].value}%
      </div>
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────── */
const PAGE_SIZE = 10;

export default function ExplorerPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const filtered = ALL_ROWS.filter((r) => {
    const matchSearch = !search || r.tx.includes(search) || r.prover.includes(search);
    const matchType = filterType === 'all' || r.type === filterType;
    return matchSearch && matchType;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            Verification{' '}
            <span style={{
              background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Explorer</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Real-time on-chain verification activity on HashKey Chain
          </p>
        </motion.div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {[
            { label: 'Total Verifications', value: 1247, display: null,   icon: '✅', color: '#00f0ff' },
            { label: 'Active Credentials',  value: 892,  display: null,   icon: '🔐', color: '#8b5cf6' },
            { label: 'Unique Users',         value: 634,  display: null,   icon: '👤', color: '#f050f0' },
            { label: 'Avg Proof Time',       value: null, display: '1.8s', icon: '⚡', color: '#10b981' },
          ].map(({ label, value, display, icon, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card card-gradient-top"
              style={{ padding: '1.5rem', position: 'relative' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1.25rem' }}>{icon}</div>
                <ArrowUpRight size={14} color="#334155" />
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                color,
                letterSpacing: '-0.03em',
                marginBottom: '0.25rem',
              }}>
                {value !== null ? (mounted ? <Counter target={value} /> : '0') : display}
              </div>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                {label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>

          {/* Area chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card"
            style={{ padding: '1.75rem' }}
          >
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'white',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f0ff', animation: 'ping-dot 1.5s ease-in-out infinite', opacity: 0.8 }} />
              Verifications Over Time
            </div>
            <div style={{ height: 220 }}>
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={AREA_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00f0ff" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="day" fontSize={9} axisLine={false} tickLine={false} stroke="#334155" interval={3} />
                    <YAxis fontSize={9} axisLine={false} tickLine={false} stroke="#334155" />
                    <Tooltip content={<AreaTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="verifications"
                      stroke="#00f0ff"
                      strokeWidth={2}
                      fill="url(#areaGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#00f0ff', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Donut chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card"
            style={{ padding: '1.75rem' }}
          >
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'white',
              marginBottom: '1.5rem',
            }}>
              Verifications by Type
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
              <div style={{ height: 180 }}>
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={PIE_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={74}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {PIE_DATA.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {PIE_DATA.map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {d.name.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: d.color, fontWeight: 700 }}>
                      {d.value}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card"
          style={{ overflow: 'hidden' }}
        >
          {/* Table toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            flexWrap: 'wrap',
          }}>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'white',
              flex: 1,
              minWidth: 120,
            }}>Recent Verifications</div>

            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#334155', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search address or tx..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '8px 14px 8px 34px',
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'white',
                  outline: 'none',
                  width: 220,
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(0,240,255,0.3)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.06)')}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                style={{
                  background: filterType !== 'all' ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${filterType !== 'all' ? 'rgba(0,240,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  color: filterType !== 'all' ? '#00f0ff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Filter size={12} />
                {filterType === 'all' ? 'All Types' : filterType.replace(/_/g, ' ')}
              </button>

              {filterOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  background: 'rgba(10,10,25,0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '8px',
                  minWidth: 200,
                  zIndex: 100,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}>
                  {(['all', ...CRED_TYPES] as string[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setFilterType(t); setFilterOpen(false); setPage(1); }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: filterType === t ? 'rgba(0,240,255,0.08)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: filterType === t ? '#00f0ff' : '#64748b',
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {t !== 'all' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: CRED_COLORS[t] }} />}
                      {t === 'all' ? 'All Types' : t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="zk-table">
              <thead>
                <tr>
                  {['Tx Hash', 'Type', 'Prover', 'Time', 'Status'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <td>
                      <span style={{ color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        {row.tx}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: `${CRED_COLORS[row.type]}14`,
                        border: `1px solid ${CRED_COLORS[row.type]}30`,
                        color: CRED_COLORS[row.type],
                        padding: '3px 10px',
                        borderRadius: 100,
                        fontSize: '10px',
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                      }}>{row.type}</span>
                    </td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#64748b' }}>
                      {row.prover}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                        <Clock size={11} />
                        {row.time}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CheckCircle size={12} color="#10b981" />
                        <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontWeight: 700 }}>
                          Valid
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#1e293b' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              ><ChevronLeft size={14} /></button>

              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '…' ? (
                    <span key={`e-${idx}`} style={{ color: '#334155', fontSize: '12px', padding: '0 4px' }}>…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      style={{
                        width: 32, height: 32,
                        borderRadius: 8,
                        border: `1px solid ${item === page ? 'rgba(0,240,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        background: item === page ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.02)',
                        color: item === page ? '#00f0ff' : '#64748b',
                        fontSize: '12px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: item === page ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >{item}</button>
                  )
                )
              }

              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  cursor: page === pageCount ? 'not-allowed' : 'pointer',
                  color: page === pageCount ? '#1e293b' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              ><ChevronRight size={14} /></button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
