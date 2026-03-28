import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Database, Users,
  Activity, Shield, ExternalLink, RefreshCw, ArrowLeft,
} from 'lucide-react';

// ─── STATIC DATA ──────────────────────────────────────────────────────────────

const PRICE_7D = [
  { t: 'Mar 22', usd: 2088, inr: 173900 },
  { t: 'Mar 23', usd: 2101, inr: 174800 },
  { t: 'Mar 24', usd: 2115, inr: 175900 },
  { t: 'Mar 25', usd: 2098, inr: 174500 },
  { t: 'Mar 26', usd: 2134, inr: 177500 },
  { t: 'Mar 27', usd: 2149, inr: 178800 },
  { t: 'Mar 28', usd: 2158, inr: 179400 },
];

const PRICE_30D = [
  { t: 'Mar 1',  usd: 2042, inr: 169800 },
  { t: 'Mar 5',  usd: 2078, inr: 172900 },
  { t: 'Mar 9',  usd: 2095, inr: 174300 },
  { t: 'Mar 13', usd: 2061, inr: 171400 },
  { t: 'Mar 17', usd: 2110, inr: 175600 },
  { t: 'Mar 21', usd: 2134, inr: 177500 },
  { t: 'Mar 25', usd: 2101, inr: 174800 },
  { t: 'Mar 28', usd: 2158, inr: 179400 },
];

const PRICE_1Y = [
  { t: 'Apr',  usd: 1980, inr: 164800 },
  { t: 'May',  usd: 1940, inr: 161500 },
  { t: 'Jun',  usd: 1965, inr: 163600 },
  { t: 'Jul',  usd: 2010, inr: 167300 },
  { t: 'Aug',  usd: 2055, inr: 171000 },
  { t: 'Sep',  usd: 2089, inr: 173800 },
  { t: 'Oct',  usd: 2040, inr: 169700 },
  { t: 'Nov',  usd: 2098, inr: 174500 },
  { t: 'Dec',  usd: 2134, inr: 177500 },
  { t: 'Jan',  usd: 2090, inr: 173900 },
  { t: 'Feb',  usd: 2105, inr: 175100 },
  { t: 'Mar',  usd: 2158, inr: 179400 },
];

const CHART_DATA: Record<string, typeof PRICE_7D> = {
  '7D': PRICE_7D, '30D': PRICE_30D, '1Y': PRICE_1Y,
};

const GOLD_BATCHES = [
  { id: 'BATCH-001', weight: 1000, purity: '24K', location: 'Dubai Vault A',       cert: 'QmX9k...Abc', status: 'Public',  date: '2024-10-15', valueUSD: 67540 },
  { id: 'BATCH-002', weight: 500,  purity: '22K', location: 'Singapore Vault B',   cert: 'QmY7n...Def', status: 'Public',  date: '2024-10-22', valueUSD: 32150 },
  { id: 'BATCH-003', weight: 2500, purity: '24K', location: 'Zurich Vault C',      cert: 'QmZ3p...Ghi', status: 'Public',  date: '2024-11-01', valueUSD: 168900 },
  { id: 'BATCH-004', weight: 750,  purity: '18K', location: 'London Vault D',      cert: 'QmA2m...Jkl', status: 'Private', date: '2024-11-08', valueUSD: 37800 },
  { id: 'BATCH-005', weight: 300,  purity: '24K', location: 'Dubai Vault A',       cert: 'QmB5q...Mno', status: 'Public',  date: '2024-11-15', valueUSD: 20260 },
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
  { hash: '0xf4a1...9b2c', type: 'MINT',     amount: 50000, time: '2 min ago' },
  { hash: '0x9c2d...1e4f', type: 'TRANSFER', amount: 1200,  time: '18 min ago' },
  { hash: '0x3b7e...8f1a', type: 'MINT',     amount: 28000, time: '45 min ago' },
  { hash: '0xd5f9...2c3e', type: 'BURN',     amount: 500,   time: '1h ago' },
  { hash: '0x1a2b...7d8e', type: 'TRANSFER', amount: 3500,  time: '2h ago' },
  { hash: '0xe8c4...0f5b', type: 'MINT',     amount: 15000, time: '3h ago' },
  { hash: '0x7f3a...4e9d', type: 'BURN',     amount: 800,   time: '5h ago' },
];

const TX_COLORS: Record<string, string> = {
  MINT: '#39FF14', BURN: '#FF4D4D', TRANSFER: '#00E5FF',
};

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, trend }: {
  icon: React.ElementType; label: string; value: string;
  sub?: string; trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-white/[0.03] border border-[#FFD700]/10 rounded-xl p-5 hover:border-[#FFD700]/25 transition-all glow-box-gold">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em]">{label}</span>
        <Icon size={14} className="text-[#FFD700] opacity-50" />
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      {sub && (
        <div className={`text-xs mt-1.5 flex items-center gap-1 font-mono ${trend === 'up' ? 'text-[#39FF14]' : 'text-[#FF4D4D]'}`}>
          {trend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {sub}
        </div>
      )}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0a0a] border border-[#FFD700]/30 rounded-lg p-3 text-xs font-mono shadow-xl">
      <p className="text-[#FFD700] mb-1">{label}</p>
      <p className="text-white">USD: <span className="text-[#FFD700]">${payload[0]?.value?.toLocaleString()}</span></p>
    </div>
  );
};

// ─── MAIN ANALYTICS PAGE ──────────────────────────────────────────────────────

export default function Analytics() {
  const [period, setPeriod] = useState<'7D' | '30D' | '1Y'>('30D');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [sortBy, setSortBy] = useState<'weight' | 'purity' | 'location'>('weight');
  const now = new Date().toLocaleTimeString();

  const chartData = CHART_DATA[period].map(d => ({
    ...d,
    value: currency === 'USD' ? d.usd : d.inr,
  }));

  const sortedBatches = [...GOLD_BATCHES].sort((a, b) => {
    if (sortBy === 'weight') return b.weight - a.weight;
    if (sortBy === 'purity') return a.purity.localeCompare(b.purity);
    return a.location.localeCompare(b.location);
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Head>
        <title>PHENOX | Gold Analytics Dashboard</title>
        <meta name="description" content="Real-time gold RWA analytics — batches, supply, holders, transactions on Monad Testnet" />
      </Head>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur border-b border-[#FFD700]/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-[#FFD700] font-mono font-bold text-lg tracking-widest">&gt;_ PHENOX</Link>
          <span className="text-gray-600 hidden md:block">|</span>
          <span className="text-gray-400 text-sm font-mono hidden md:block">Gold Analytics</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-gray-600">
            <RefreshCw size={10} /> Updated: {now}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="text-gray-500">Monad Testnet</span>
          </div>
          <a href="http://localhost:3000/admin/login" className="text-xs border border-[#FFD700]/30 text-[#FFD700] px-3 py-1.5 rounded hover:bg-[#FFD700]/10 transition font-mono">
            Admin →
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* ── GLOBAL STATS ── */}
        <section>
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-4">Global Market Overview</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={TrendingUp}  label="Total Tokenized"   value="$326.4M"   sub="+2.7% 24h"  trend="up" />
            <StatCard icon={Activity}    label="PGOLD Price"        value="$2,158"    sub="+1.35% 24h" trend="up" />
            <StatCard icon={Database}    label="Total Batches"      value="5"         />
            <StatCard icon={Users}       label="Active Holders"     value="127"       />
            <StatCard icon={TrendingUp}  label="Total Supply"       value="200K"      sub="+12K today" trend="up" />
            <StatCard icon={Shield}      label="Vault Reserve"      value="5,050g"    sub="Physical Au" trend="up" />
          </div>
        </section>

        {/* ── GOLD PRICE CHART ── */}
        <section className="bg-white/[0.02] border border-[#FFD700]/10 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold">Gold Price ({currency}/oz)</h2>
              <p className="text-gray-600 text-xs font-mono mt-0.5">Historical price trend — PGOLD token</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Currency toggle */}
              <div className="flex rounded-lg overflow-hidden border border-[#FFD700]/20">
                {(['USD', 'INR'] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={`px-3 py-1.5 text-xs font-mono transition-all ${currency === c ? 'bg-[#FFD700] text-black' : 'text-gray-500 hover:text-white'}`}>
                    {c}
                  </button>
                ))}
              </div>
              {/* Period toggle */}
              <div className="flex rounded-lg overflow-hidden border border-[#FFD700]/20">
                {(['7D', '30D', '1Y'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-mono transition-all ${period === p ? 'bg-[#FFD700] text-black' : 'text-gray-500 hover:text-white'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-4 mb-6">
            <span className="text-4xl font-black text-[#FFD700] glow-gold">
              {currency === 'USD' ? '$2,158' : '₹1,79,400'}
            </span>
            <span className="text-[#39FF14] text-sm font-mono pb-1">▲ +1.35%</span>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FFD700" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,215,0,0.05)" />
              <XAxis dataKey="t"     tick={{ fill: '#4b5563', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="value" tick={{ fill: '#4b5563', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false}
                domain={['dataMin - 50', 'dataMax + 50']}
                tickFormatter={v => currency === 'USD' ? `$${v.toLocaleString()}` : `₹${v.toLocaleString()}`}
                width={75}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#FFD700" strokeWidth={2.5}
                fill="url(#goldGrad)" dot={false} activeDot={{ r: 5, fill: '#FFD700', stroke: '#050505', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        {/* ── GOLD BATCH REGISTRY ── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-white">Gold Batch Registry</h2>
              <p className="text-gray-600 text-xs font-mono mt-0.5">Every vault batch recorded on-chain</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 font-mono">Sort by:</span>
              {(['weight', 'purity', 'location'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1 text-xs font-mono rounded border transition-all ${sortBy === s ? 'border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10' : 'border-white/10 text-gray-500 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.02] border border-[#FFD700]/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#FFD700]/10">
                    {['Batch ID', 'Weight (g)', 'Purity', 'Location', 'Certification', 'Status', 'Value (USD)', 'Added'].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-[10px] font-mono text-gray-600 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBatches.map((b, i) => (
                    <tr key={b.id}
                      className={`border-b border-white/[0.03] hover:bg-[#FFD700]/[0.03] transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                      <td className="px-5 py-3.5 font-mono text-[#FFD700] text-xs font-semibold">{b.id}</td>
                      <td className="px-5 py-3.5 text-white font-semibold">{b.weight.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-gray-300 font-mono">{b.purity}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{b.location}</td>
                      <td className="px-5 py-3.5">
                        <button className="flex items-center gap-1 text-[#00E5FF] text-xs font-mono hover:underline">
                          {b.cert} <ExternalLink size={10} />
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold ${b.status === 'Public' ? 'bg-[#39FF14]/10 text-[#39FF14]' : 'bg-gray-500/10 text-gray-500'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-white font-mono">${b.valueUSD.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs font-mono">{b.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── SPLIT: HOLDERS + TRANSACTIONS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* HOLDER LEADERBOARD */}
          <section>
            <h2 className="font-bold text-white mb-1">Top PGOLD Holders</h2>
            <p className="text-gray-600 text-xs font-mono mb-4">League table — wallet addresses only</p>
            <div className="bg-white/[0.02] border border-[#FFD700]/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#FFD700]/10">
                    {['#', 'Address', 'Balance', '% Supply'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[10px] font-mono text-gray-600 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TOP_HOLDERS.map((h) => (
                    <tr key={h.rank} className="border-b border-white/[0.03] hover:bg-[#FFD700]/[0.03] transition-colors">
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{h.rank}</td>
                      <td className="px-5 py-3 font-mono text-[#00E5FF] text-xs">{h.address}</td>
                      <td className="px-5 py-3 text-white text-xs font-mono whitespace-nowrap">{h.balance.toLocaleString()} PGOLD</td>
                      <td className="px-5 py-3 w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/[0.07] rounded-full overflow-hidden">
                            <div className="h-full bg-[#FFD700] rounded-full" style={{ width: `${Math.min(h.pct * 4, 100)}%` }} />
                          </div>
                          <span className="text-gray-500 text-[11px] font-mono">{h.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* LIVE TRANSACTIONS */}
          <section>
            <h2 className="font-bold text-white mb-1">Latest Transactions</h2>
            <p className="text-gray-600 text-xs font-mono mb-4">Recent on-chain events — mint / burn / transfer</p>
            <div className="bg-white/[0.02] border border-[#FFD700]/10 rounded-2xl divide-y divide-white/[0.03]">
              {TRANSACTIONS.map((tx) => (
                <div key={tx.hash} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#FFD700]/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold"
                      style={{ color: TX_COLORS[tx.type], background: `${TX_COLORS[tx.type]}18` }}>
                      {tx.type}
                    </span>
                    <button className="font-mono text-xs text-[#00E5FF] hover:underline flex items-center gap-1">
                      {tx.hash} <ExternalLink size={9} />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-white text-sm font-semibold">{tx.amount.toLocaleString()} PGOLD</div>
                    <div className="text-gray-600 text-[11px] font-mono">{tx.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── TRADING ACTIVITY ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: '24h Trading Volume', value: '8,200 PGOLD', sub: '$17.68M' },
            { label: 'Number of Trades',   value: '342',         sub: 'last 24 hours' },
            { label: 'PGOLD/USD',          value: '$2.155',      sub: 'per token' },
          ].map(c => (
            <div key={c.label} className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl p-5 text-center hover:border-[#FFD700]/25 transition-all">
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">{c.label}</p>
              <p className="text-2xl font-black text-[#FFD700]">{c.value}</p>
              <p className="text-gray-500 text-xs font-mono mt-1">{c.sub}</p>
            </div>
          ))}
        </section>

        {/* ── VAULT RESERVE & PROOF OF RESERVE ── */}
        <section className="relative overflow-hidden bg-gradient-to-r from-[#FFD700]/[0.06] to-transparent border border-[#FFD700]/20 rounded-2xl p-8">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#FFD700] opacity-[0.03] blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <h2 className="text-xl font-black mb-1">🏦 Vault Reserve & Proof of Reserve</h2>
              <p className="text-gray-500 text-sm max-w-md">
                Every gram of physical gold backing PGOLD is verified cryptographically on Monad Testnet.
                Third-party audits available on IPFS.
              </p>
            </div>
            <div className="flex items-center gap-8 flex-shrink-0">
              <div className="text-center">
                <div className="text-4xl font-black text-[#FFD700] glow-gold">5,050<span className="text-xl">g</span></div>
                <div className="text-gray-600 text-xs font-mono mt-1">Physical Gold Total</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-white">$326.4M</div>
                <div className="text-gray-600 text-xs font-mono mt-1">Current Value</div>
              </div>
              <div>
                <span className="px-4 py-2 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 rounded-full text-sm font-mono font-bold">
                  ✓ VERIFIED
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 mt-6 relative z-10">
            <button className="flex items-center gap-1.5 text-xs font-mono text-[#FFD700] border border-[#FFD700]/30 px-4 py-2 rounded hover:bg-[#FFD700]/10 transition-all">
              <ExternalLink size={11} /> Audit Report (IPFS)
            </button>
            <button className="flex items-center gap-1.5 text-xs font-mono text-gray-500 border border-white/10 px-4 py-2 rounded hover:text-white transition-all">
              <ExternalLink size={11} /> Monad Explorer
            </button>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#FFD700]/10 px-8 py-6 text-center mt-10">
        <p className="text-gray-700 text-xs font-mono">
          PHENOX Public Panel &copy; 2025 · Gold-Backed RWA on Monad Testnet · Data is static (hackathon demo)
        </p>
      </footer>
    </div>
  );
}
