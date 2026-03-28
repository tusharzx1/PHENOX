import Head from 'next/head';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, Database, Users, Activity, Shield, ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';

// ─── STATIC DATA ──────────────────────────────────────────
const GOLD_PRICE_DATA = [
  { day: 'Mar 1',  usd: 2042, inr: 169800 },
  { day: 'Mar 5',  usd: 2078, inr: 172900 },
  { day: 'Mar 9',  usd: 2095, inr: 174300 },
  { day: 'Mar 13', usd: 2061, inr: 171400 },
  { day: 'Mar 17', usd: 2110, inr: 175600 },
  { day: 'Mar 21', usd: 2134, inr: 177500 },
  { day: 'Mar 25', usd: 2101, inr: 174800 },
  { day: 'Mar 28', usd: 2158, inr: 179400 },
];

const GOLD_BATCHES = [
  { id: 'BATCH-001', weight: 1000, purity: '24K', location: 'Dubai Vault A', cert: 'QmX9k...Abc', status: 'Public',  date: '2024-10-15', valueUSD: 67540 },
  { id: 'BATCH-002', weight: 500,  purity: '22K', location: 'Singapore Vault B', cert: 'QmY7n...Def', status: 'Public',  date: '2024-10-22', valueUSD: 32150 },
  { id: 'BATCH-003', weight: 2500, purity: '24K', location: 'Zurich Vault C', cert: 'QmZ3p...Ghi', status: 'Public',  date: '2024-11-01', valueUSD: 168900 },
  { id: 'BATCH-004', weight: 750,  purity: '18K', location: 'London Vault D', cert: 'QmA2m...Jkl', status: 'Private', date: '2024-11-08', valueUSD: 37800 },
  { id: 'BATCH-005', weight: 300,  purity: '24K', location: 'Dubai Vault A', cert: 'QmB5q...Mno', status: 'Public',  date: '2024-11-15', valueUSD: 20260 },
];

const TOP_HOLDERS = [
  { rank: 1, address: '0x236739...C4F8', balance: 50000, pct: 25.0 },
  { rank: 2, address: '0xAb82Fc...9E21', balance: 35000, pct: 17.5 },
  { rank: 3, address: '0xC4d107...3B9A', balance: 28000, pct: 14.0 },
  { rank: 4, address: '0xE7f3A9...7D5C', balance: 21500, pct: 10.75 },
  { rank: 5, address: '0x91B2E6...1F2D', balance: 15000, pct: 7.5 },
  { rank: 6, address: '0x5F8D3C...A4B8', balance: 12000, pct: 6.0 },
  { rank: 7, address: '0x3A9F71...C3E7', balance: 9500,  pct: 4.75 },
  { rank: 8, address: '0x8C2B54...D6F9', balance: 7000,  pct: 3.5 },
];

const TRANSACTIONS = [
  { hash: '0xf4a1...9b2c', type: 'MINT',     amount: 50000, time: '2 min ago',  color: '#39FF14' },
  { hash: '0x9c2d...1e4f', type: 'TRANSFER', amount: 1200,  time: '18 min ago', color: '#00E5FF' },
  { hash: '0x3b7e...8f1a', type: 'MINT',     amount: 28000, time: '45 min ago', color: '#39FF14' },
  { hash: '0xd5f9...2c3e', type: 'BURN',     amount: 500,   time: '1h ago',     color: '#FF4D4D' },
  { hash: '0x1a2b...7d8e', type: 'TRANSFER', amount: 3500,  time: '2h ago',     color: '#00E5FF' },
  { hash: '0xe8c4...0f5b', type: 'MINT',     amount: 15000, time: '3h ago',     color: '#39FF14' },
  { hash: '0x7f3a...4e9d', type: 'BURN',     amount: 800,   time: '5h ago',     color: '#FF4D4D' },
];

// ─── SUB-COMPONENTS ────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, up }: {
  icon: React.ElementType; label: string; value: string; sub?: string; up?: boolean;
}) {
  return (
    <div className="bg-white/[0.03] border border-[#FFD700]/10 rounded-xl p-5 hover:border-[#FFD700]/25 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">{label}</span>
        <Icon size={16} className="text-[#FFD700] opacity-60" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${up ? 'text-[#39FF14]' : 'text-[#FF4D4D]'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {sub}
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-black border border-[#FFD700]/30 rounded-lg p-3 text-xs font-mono">
        <p className="text-[#FFD700] mb-1">{label}</p>
        <p className="text-white">USD: ${payload[0]?.value?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

// ─── MAIN PAGE ─────────────────────────────────────────────
export default function PublicAnalytics() {
  const [lastUpdated] = useState(() => new Date().toLocaleTimeString());

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Head>
        <title>PHENOX | Gold Analytics Dashboard</title>
        <meta name="description" content="Real-time gold RWA analytics on Monad Testnet" />
      </Head>

      {/* Header */}
      <header className="border-b border-[#FFD700]/10 px-8 py-4 flex items-center justify-between sticky top-0 z-20 bg-[#050505]/90 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <Link href="/public" className="font-mono font-bold text-[#FFD700] tracking-widest text-lg">&gt;_ PHENOX</Link>
          <span className="text-gray-600 hidden md:block">|</span>
          <span className="text-gray-400 text-sm hidden md:block font-mono">Gold Analytics Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-600 font-mono hidden md:flex items-center gap-2">
            <RefreshCw size={11} /> Last updated: {lastUpdated}
          </span>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="text-gray-400">Monad Testnet</span>
          </div>
          <Link href="/admin/login" className="text-xs border border-[#FFD700]/30 text-[#FFD700] px-3 py-1.5 rounded hover:bg-[#FFD700]/10 transition-all font-mono">
            Admin →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── SECTION 1: GLOBAL STATS ── */}
        <section>
          <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">Global Market Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={TrendingUp}  label="Total Tokenized"  value="$326.4M"  sub="+2.7% (24h)" up />
            <StatCard icon={Activity}    label="Gold Price"        value="$2,158"   sub="+1.35% (24h)" up />
            <StatCard icon={Database}    label="Total Batches"     value="5"        />
            <StatCard icon={Users}       label="Active Holders"    value="127"      />
            <StatCard icon={Shield}      label="Total Supply"      value="200K"     sub="PGOLD tokens" up />
            <StatCard icon={Shield}      label="Vault Reserve"     value="5,050g"   sub="Physical Gold" up />
          </div>
        </section>

        {/* ── SECTION 2: GOLD PRICE CHART ── */}
        <section className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Gold Price (USD/oz)</h2>
              <p className="text-gray-500 text-xs font-mono mt-1">Historical 28-day trend</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-[#FFD700]">$2,158</div>
              <div className="text-[#39FF14] text-xs font-mono">▲ +$28.50 (1.35%)</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={GOLD_PRICE_DATA} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FFD700" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,215,0,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} domain={['dataMin - 50', 'dataMax + 50']} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="usd" stroke="#FFD700" strokeWidth={2} fill="url(#goldGrad)" dot={false} activeDot={{ r: 4, fill: '#FFD700' }} />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        {/* ── SECTION 3: GOLD BATCHES TABLE ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Gold Batch Registry</h2>
            <span className="text-xs text-gray-600 font-mono">On-chain • Monad Testnet</span>
          </div>
          <div className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#FFD700]/10">
                    {['Batch ID', 'Weight (g)', 'Purity', 'Location', 'Certification', 'Status', 'Value (USD)', 'Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GOLD_BATCHES.map((b, i) => (
                    <tr key={b.id} className={`border-b border-white/[0.03] hover:bg-[#FFD700]/[0.03] transition-colors ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                      <td className="px-4 py-3 font-mono text-[#FFD700] text-xs">{b.id}</td>
                      <td className="px-4 py-3 text-white font-semibold">{b.weight.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">{b.purity}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{b.location}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-[#00E5FF] text-xs font-mono hover:underline cursor-pointer">
                          {b.cert} <ExternalLink size={10} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${b.status === 'Public' ? 'bg-[#39FF14]/10 text-[#39FF14]' : 'bg-gray-500/10 text-gray-500'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">${b.valueUSD.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{b.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: SPLIT — HOLDERS + TRANSACTIONS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* HOLDERS LEADERBOARD */}
          <section>
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">Top PGOLD Holders</h2>
            <div className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#FFD700]/10">
                    {['#', 'Address', 'Balance', '% Supply'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TOP_HOLDERS.map((h) => (
                    <tr key={h.rank} className="border-b border-white/[0.03] hover:bg-[#FFD700]/[0.03] transition-colors">
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{h.rank}</td>
                      <td className="px-4 py-2.5 font-mono text-[#00E5FF] text-xs">{h.address}</td>
                      <td className="px-4 py-2.5 text-white text-xs">{h.balance.toLocaleString()} PGOLD</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/10 rounded">
                            <div className="h-1 bg-[#FFD700] rounded" style={{ width: `${h.pct * 4}%` }} />
                          </div>
                          <span className="text-gray-400 text-xs font-mono">{h.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* TRANSACTION FEED */}
          <section>
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">Latest Transactions</h2>
            <div className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl divide-y divide-white/[0.03]">
              {TRANSACTIONS.map((tx) => (
                <div key={tx.hash} className="flex items-center justify-between px-4 py-3 hover:bg-[#FFD700]/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ color: tx.color, backgroundColor: `${tx.color}15` }}>
                      {tx.type}
                    </span>
                    <span className="font-mono text-xs text-[#00E5FF] hover:underline cursor-pointer flex items-center gap-1">
                      {tx.hash} <ExternalLink size={10} />
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-white text-sm font-semibold">{tx.amount.toLocaleString()} PGOLD</div>
                    <div className="text-gray-600 text-xs font-mono">{tx.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── SECTION 5: VAULT RESERVE ── */}
        <section className="bg-gradient-to-r from-[#FFD700]/5 to-transparent border border-[#FFD700]/20 rounded-xl p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">🏦 Vault Reserve &amp; Proof of Reserve</h2>
              <p className="text-gray-400 text-sm">Physical gold backing verified on-chain via Monad Testnet smart contracts.</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-black text-[#FFD700]">5,050g</div>
                <div className="text-gray-500 text-xs font-mono">Total Physical Gold</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-white">$326.4M</div>
                <div className="text-gray-500 text-xs font-mono">Current Value</div>
              </div>
              <div className="text-center">
                <span className="px-3 py-1.5 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 rounded-full text-xs font-mono font-bold">
                  ✓ VERIFIED
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button className="text-xs font-mono text-[#FFD700] underline hover:no-underline flex items-center gap-1">
              View Audit Report <ExternalLink size={10} />
            </button>
            <button className="text-xs font-mono text-gray-500 underline hover:no-underline flex items-center gap-1">
              Monad Explorer <ExternalLink size={10} />
            </button>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#FFD700]/10 px-8 py-6 text-center text-gray-600 text-xs font-mono">
        PHENOX &copy; 2025 — Gold-Backed RWA on Monad Testnet | Data refreshes every 30s
      </footer>
    </div>
  );
}
