import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Database, Users,
  Activity, Shield, ExternalLink, RefreshCw, ArrowLeft,
  Wifi, WifiOff, Zap, Search, Bell, Settings,
  Home, PieChart, BarChart2, Layers, BookOpen, User, Hexagon, Server
} from 'lucide-react';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const REFRESH_INTERVAL = 30_000; // 30 seconds

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface GoldPrice {
  usdPerOz: number;
  inrPerOz: number;
  usdPerGram: number;
  inrPerGram: number;
  change24h: number;
  changePct24h: number;
  lastUpdate: string;
  source: string;
}

interface TokenStats {
  name: string;
  symbol: string;
  totalSupplyGrams: number;
  totalSupplyFormatted: string;
  marketCapUSD: number;
  marketCapINR: number;
  marketCapFormatted: string;
  activeHolders: number;
  totalBatches: number;
  vaultReserveGrams: number;
  volumeUSD24h: number;
  trades24h: number;
  pgoldUsdPrice: number;
}

interface PricePoint { t: string; usd: number; inr: number; value?: number; }
type ChartHistory = { '7D': PricePoint[]; '30D': PricePoint[]; '1Y': PricePoint[] };

// ─── STATIC FALLBACK DATA (used until API responds) ───────────────────────────
const GOLD_BATCHES = [
  { id: 'BATCH-001', weight: 1000, purity: '24K', location: 'Dubai Vault A',     cert: 'QmX9k...Abc', status: 'Public',  date: '2024-10-15', network: 'Monad' },
  { id: 'BATCH-002', weight: 500,  purity: '22K', location: 'Singapore Vault B', cert: 'QmY7n...Def', status: 'Public',  date: '2024-10-22', network: 'Monad' },
  { id: 'BATCH-003', weight: 2500, purity: '24K', location: 'Zurich Vault C',    cert: 'QmZ3p...Ghi', status: 'Public',  date: '2024-11-01', network: 'Monad' },
  { id: 'BATCH-004', weight: 750,  purity: '18K', location: 'London Vault D',    cert: 'QmA2m...Jkl', status: 'Private', date: '2024-11-08', network: 'Monad' },
  { id: 'BATCH-005', weight: 300,  purity: '24K', location: 'Dubai Vault A',     cert: 'QmB5q...Mno', status: 'Public',  date: '2024-11-15', network: 'Monad' },
];

// ─── CUSTOM HOOKS ──────────────────────────────────────────────────────────────
function useGoldData() {
  const [price, setPrice]   = useState<GoldPrice | null>(null);
  const [stats, setStats]   = useState<TokenStats | null>(null);
  const [history, setHistory] = useState<ChartHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [priceRes, statsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/api/gold/price`).catch(() => null),
        fetch(`${API_BASE}/api/gold/stats`).catch(() => null),
        fetch(`${API_BASE}/api/gold/history`).catch(() => null),
      ]);

      if (!priceRes?.ok || !statsRes?.ok || !historyRes?.ok) {
        throw new Error('API partially or fully offline');
      }

      const [priceJson, statsJson, historyJson] = await Promise.all([
        priceRes.json(),
        statsRes.json(),
        historyRes.json(),
      ]);

      setPrice(priceJson.data);
      setStats(statsJson.data?.token);
      setHistory(historyJson.data);
      setOnline(true);
      setLastRefresh(new Date());
    } catch (err) {
      console.warn('[PHENOX] API unavailable, using fallback data');
      setOnline(false);
      // Setup realistic fallback so UI doesn't break
      setPrice({
        usdPerOz: 2350.50, inrPerOz: 195000,
        usdPerGram: 75.57, inrPerGram: 6270,
        change24h: 12.5, changePct24h: 0.53,
        lastUpdate: new Date().toISOString(), source: 'Fallback (Offline)'
      });
      setStats({
        name: 'PGOLD', symbol: 'PGOLD',
        totalSupplyGrams: 5050, totalSupplyFormatted: '5,050',
        marketCapUSD: 5050 * 75.57, marketCapINR: 5050 * 6270,
        marketCapFormatted: '$381.6K',
        activeHolders: 127, totalBatches: 5, vaultReserveGrams: 5050,
        volumeUSD24h: 15400, trades24h: 34, pgoldUsdPrice: 75.57
      });
      // Minimal static history so chart renders
      setHistory({
        '7D': [ { t: 'Mon', usd: 2300, inr: 190000 }, { t: 'Today', usd: 2350.5, inr: 195000 } ],
        '30D': [ { t: '1st', usd: 2200, inr: 180000 }, { t: 'Today', usd: 2350.5, inr: 195000 } ],
        '1Y': [ { t: 'Jan', usd: 1900, inr: 150000 }, { t: 'Today', usd: 2350.5, inr: 195000 } ]
      });
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  return { price, stats, history, loading, online, lastRefresh, refetch: fetchAll };
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const navTabs = [
    { label: 'Latest', items: [
      { id: 'Market Overview', icon: Home },
      { id: 'News', icon: BookOpen },
      { id: 'Asset Screener', icon: Layers },
    ]},
    { label: 'Asset Classes', items: [
      { id: 'Stablecoins', icon: PieChart },
      { id: 'U.S. Treasuries', icon: BarChart2 },
      { id: 'Commodities', icon: Hexagon, badge: 'NEW' },
    ]},
    { label: 'Participants', items: [
      { id: 'Networks', icon: Server },
      { id: 'Asset Managers', icon: User },
    ]}
  ];

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-logo">
        <div className="logo-icon">P</div>
        <div>
          <div className="logo-text">PHENOX</div>
          <div className="logo-sub">Tokenized Gold</div>
        </div>
      </Link>
      
      {navTabs.map(section => (
        <div className="nav-section" key={section.label}>
          <div className="nav-label">{section.label}</div>
          {section.items.map(item => (
            <button
              key={item.id}
              className={`nav-item w-full text-left bg-transparent border-0 outline-none ${activeTab === item.id ? 'active' : ''}`}
              style={{ padding: '7px 10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '9px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon size={16} /> <span>{item.id}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}

function Topbar() {
  return (
    <header className="topbar">
      <div className="search-box">
        <Search size={16} />
        <input type="text" placeholder="Search..." />
        <span className="kbd">CTRL + K</span>
      </div>
      <div className="topbar-actions">
        <a href="#" className="btn-outline">Contact</a>
        <a href="http://localhost:3000/admin/login" className="btn-primary">Sign in</a>
      </div>
    </header>
  );
}

function TickerBar({ price, loading }: { price: GoldPrice | null, loading: boolean }) {
  if (loading || !price) return <div className="ticker-bar"></div>;
  const changeCls = price.changePct24h >= 0 ? 'up' : 'down';
  const arrow = price.changePct24h >= 0 ? '▲' : '▼';
  
  return (
    <div className="ticker-bar">
      <div className="ticker-track">
        {Array(10).fill(0).map((_, i) => (
          <div className="ticker-item" key={i}>
            <span style={{color: '#fcd34d'}}>XAU/USD</span> 
            <strong>${price.usdPerOz.toLocaleString()}</strong> 
            <span className={changeCls}>{arrow} {Math.abs(price.changePct24h).toFixed(2)}%</span>
            <span style={{margin: '0 10px', color: 'rgba(255,255,255,0.2)'}}>|</span>
            <span style={{color: '#93c5fd'}}>PGOLD Vault</span>
            <strong>5,050g</strong>
            <span style={{margin: '0 10px', color: 'rgba(255,255,255,0.2)'}}>|</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-lg">
      <p className="text-slate-500 mb-1 font-medium">{label}</p>
      <p className="text-slate-900 font-bold text-sm">
        ${payload[0]?.value?.toLocaleString()}
      </p>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { price, stats, history, loading, online, lastRefresh, refetch } = useGoldData();
  const [activeTab, setActiveTab] = useState('Commodities');
  const [period, setPeriod] = useState<'7D' | '30D' | '1Y'>('30D');
  const [metricTab, setMetricTab] = useState<'Market Caps' | 'Transfer Volume' | 'Mint / Burn Volumes'>('Market Caps');

  const chartData = history ? history[period].map(d => ({ ...d, value: d.usd })) : [];
  const vaultTotal = stats?.vaultReserveGrams ?? 5050;
  
  const batchesWithValue = GOLD_BATCHES.map(b => ({
    ...b,
    valueUSD: price ? +(b.weight * price.usdPerGram).toFixed(2) : 0,
  }));

  return (
    <div className="layout">
      <Head>
        <title>PHENOX | {activeTab}</title>
      </Head>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-area">
        <Topbar />
        
        {/* Ticker Bar (Dark blue bar below topnav like RWA limit) */}
        <TickerBar price={price} loading={loading} />

        <div className="content-scroll">
          
          {/* OFFLINE BANNER */}
          {!online && (
            <div className="offline-banner">
              <WifiOff size={16} />
              <span>Backend API is currently unreachable. Displaying fallback/mock data. Please ensure <code className="bg-orange-100 px-1 rounded">npm run dev</code> is running in the backend folder.</span>
            </div>
          )}

          {activeTab !== 'Commodities' ? (
            <div className="flex flex-col items-center justify-center pt-32 pb-32">
              <Database size={64} className="mb-6 opacity-20 text-slate-400" />
              <h2 className="text-2xl font-bold text-slate-700 mb-2">{activeTab}</h2>
              <p className="text-slate-500">This section is currently under construction for the hackathon demo.</p>
              <button 
                onClick={() => setActiveTab('Commodities')} 
                className="mt-8 px-5 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition shadow-sm border-0 cursor-pointer text-sm"
              >
                Return to Commodities
              </button>
            </div>
          ) : (
            <>
              {/* PAGE HEADER */}
              <div className="page-header">
                <h1 className="page-title">Tokenized {activeTab}</h1>
                <p className="page-desc">
                  Explore tokenized physical commodities, commodity-linked securities, and funds providing exposure to raw materials and natural resources powered by PHENOX on Monad Testnet.
                </p>
              </div>

              {/* STATS ROW (4 Columns) */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Market Cap <span className="opacity-50">ⓘ</span></div>
              <div className="stat-value">
                {loading ? <div className="skeleton h-[34px] w-[120px]"></div> : (stats?.marketCapFormatted || '$381.6K')}
              </div>
              {!loading && price && (
                <div className={`stat-change ${price.changePct24h >= 0 ? 'up' : 'down'}`}>
                  {price.changePct24h >= 0 ? '▲' : '▼'} {Math.abs(price.changePct24h).toFixed(2)}% from 30d ago
                </div>
              )}
            </div>
            
            <div className="stat-card">
              <div className="stat-label">Monthly Transfer Volume <span className="opacity-50">ⓘ</span></div>
              <div className="stat-value">
                {loading ? <div className="skeleton h-[34px] w-[90px]"></div> : `$${((stats?.volumeUSD24h || 15400) * 30 / 1000).toFixed(1)}K`}
              </div>
              <div className="stat-change up">▲ +12.4% from 30d ago</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Monthly Active Addresses <span className="opacity-50">ⓘ</span></div>
              <div className="stat-value">
                {loading ? <div className="skeleton h-[34px] w-[70px]"></div> : (stats?.activeHolders || 127).toLocaleString()}
              </div>
              <div className="stat-change up">▲ +5.2% from 30d ago</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Holders <span className="opacity-50">ⓘ</span></div>
              <div className="stat-value">
                {loading ? <div className="skeleton h-[34px] w-[80px]"></div> : (stats?.activeHolders || 127).toLocaleString()}
              </div>
              <div className="stat-change up">▲ +2.1% from 30d ago</div>
            </div>
          </div>

          {/* CHART CARD */}
          <div className="chart-card">
            <div className="chart-header">
              <h2 className="chart-title">Tokenized Commodity Metrics</h2>
              <div className="chart-controls">
                <span className="text-[12px] font-semibold mr-2">Metric</span>
                <div className="tab-group">
                  {(['Market Caps', 'Transfer Volume', 'Mint / Burn Volumes'] as const).map(tab => (
                    <button 
                      key={tab} 
                      className={`tab-btn ${metricTab === tab ? 'active' : ''}`}
                      onClick={() => setMetricTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                
                <span className="text-[12px] font-semibold ml-4 mr-2">Timeframe</span>
                <div className="tab-group">
                  {(['7D', '30D', '1Y'] as const).map(p => (
                    <button 
                      key={p} 
                      className={`tab-btn ${period === p ? 'active' : ''}`}
                      onClick={() => setPeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[300px] w-full mt-4">
              {loading || chartData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="skeleton w-full h-full rounded-lg"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="t" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                      domain={['dataMin - 50', 'dataMax + 50']}
                      width={60}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ASSET LEAGUE TABLE */}
          <div className="refresh-bar mt-8">
            <h2 className="section-title mb-0">Commodity Assets</h2>
            <div className="flex gap-4 items-center">
              <span className="refresh-info">
                {online ? <span className="live-dot"></span> : <WifiOff size={12} className="text-red-500" />}
                {online ? 'Live from Monad Testnet' : 'Offline'}
                {lastRefresh && ` • Updated: ${lastRefresh.toLocaleTimeString()}`}
              </span>
              <button className="refresh-btn" onClick={refetch}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          <div className="table-card">
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th style={{width: '60px'}}>Rank</th>
                    <th>Asset</th>
                    <th>Network</th>
                    <th className="r">Total Value</th>
                    <th className="r">Physical Weight</th>
                    <th className="r">Vault Status</th>
                  </tr>
                </thead>
                <tbody>
                  {/* MAIN TOKEN ROW */}
                  <tr>
                    <td className="font-semibold text-slate-400">1</td>
                    <td>
                      <div className="asset-cell">
                        <div className="asset-icon pgold">P</div>
                        <div>
                          <div className="asset-name">PHENOX Gold</div>
                          <div className="asset-ticker">PGOLD • Monad Foundation</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="network-chip">
                        <div className="net-dot" style={{background: '#8b5cf6'}}></div> Monad
                      </div>
                    </td>
                    <td className="r font-bold text-[14px]">
                      {loading ? <div className="skeleton h-[20px] w-[80px] ml-auto"></div> : (stats?.marketCapFormatted || '$381.6K')}
                    </td>
                    <td className="r font-mono">
                      {loading ? <div className="skeleton h-[20px] w-[60px] ml-auto"></div> : `${vaultTotal.toLocaleString()}g`}
                    </td>
                    <td className="r">
                      <span className="badge badge-green">Verified</span>
                    </td>
                  </tr>

                  {/* BATCH ROWS (Show parts of the asset) */}
                  {batchesWithValue.map((b, i) => (
                    <tr key={b.id}>
                      <td className="text-slate-400 text-xs text-right pr-6">↳</td>
                      <td>
                        <div className="asset-cell" style={{paddingLeft: '10px'}}>
                          <div className="asset-icon" style={{background: '#f1f5f9', color: '#64748b', transform: 'scale(0.8)'}}>📦</div>
                          <div>
                            <div className="asset-name text-[12px]">{b.id}</div>
                            <div className="asset-ticker">{b.location} • {b.purity}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="network-chip" style={{opacity: 0.8}}>
                          <div className="net-dot" style={{background: '#8b5cf6'}}></div> Monad Vault
                        </div>
                      </td>
                      <td className="r font-medium text-[13px] text-slate-600">
                        {loading ? '...' : `$${b.valueUSD.toLocaleString()}`}
                      </td>
                      <td className="r text-slate-600 text-[12px]">
                        {b.weight.toLocaleString()}g
                      </td>
                      <td className="r">
                        <span className={`badge ${b.status === 'Public' ? 'badge-blue' : 'badge-gray'}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* PROOF OF RESERVE STRIP */}
          <div className="por-strip">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} color="#d4a017" />
                <h3 className="font-bold text-[#92400e]">Proof of Reserve</h3>
              </div>
              <p className="text-[13px] text-[#b45309] max-w-md">
                100% physically backed by allocated gold bars. Audited and verifiable on the Monad testnet blockchain.
              </p>
            </div>
            
            <div className="flex items-center gap-8">
              <div>
                <div className="por-label">Total Allocated</div>
                <div className="por-value">{(stats?.vaultReserveGrams ?? 5050).toLocaleString()} <span className="text-[14px]">grams</span></div>
              </div>
              <div>
                <div className="por-label">Live Value (USD)</div>
                <div className="por-value">
                  {price ? `$${((stats?.vaultReserveGrams ?? 5050) * price.usdPerGram).toLocaleString(undefined, {maximumFractionDigits: 0})}` : '...'}
                </div>
              </div>
              <div className="verified-chip">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Fully Audited
              </div>
            </div>
          </div>
          </>
          )}

          <div style={{height: '40px'}}></div>
        </div>
      </div>
    </div>
  );
}
