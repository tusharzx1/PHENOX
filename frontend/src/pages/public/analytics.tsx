import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ElementType } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import {
  Activity,
  BarChart3,
  Coins,
  Landmark,
  Network,
  Newspaper,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

type TabKey = 'stablecoins' | 'market' | 'news' | 'networks' | 'treasuries' | 'commodities';

type StablecoinItem = {
  name: string;
  symbol: string;
  marketCapUsd: number;
  totalSupply: number;
  pegVariancePct: number;
  chainDistribution: Array<{ chain: string; supplyUsd: number; sharePct: number }>;
};

type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  currentPriceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  priceChange24hPct: number;
};

type NewsItem = {
  id: string | number;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  categories: string[];
};

type NetworkItem = {
  name: string;
  chainId: number | null;
  tokenSymbol: string | null;
  tvlUsd: number | null;
  activeAddresses24h: number | null;
  activeAddressesSource?: string;
};

type TreasuryItem = {
  symbol: string;
  name: string;
  contract: string;
  totalSupply: number;
  priceUsd: number;
  tvlUsd: number;
};

type CommoditiesData = {
  usd: number;
  inr: number;
  vaultStatus?: string;
  reserveLocation?: string;
};

type PublicLedgerRecord = {
  batchId: string;
  weight: number;
  purity: number;
  location: string;
  certification?: string;
  timestamp?: string;
  onChain?: {
    status?: string;
    txHash?: string;
  };
};

const TABS: Array<{
  key: TabKey;
  label: string;
  provider: string;
  icon: ElementType;
  category: string;
}> = [
  {
    key: 'stablecoins',
    label: 'Stablecoins',
    provider: 'DeFiLlama Stablecoins API',
    icon: Coins,
    category: 'Market Cap, Supply, Peg Variance',
  },
  {
    key: 'market',
    label: 'Market Overview',
    provider: 'CoinGecko API (Free Tier)',
    icon: BarChart3,
    category: 'Global Crypto & RWA Token Metrics',
  },
  {
    key: 'news',
    label: 'News',
    provider: 'CryptoCompare News API',
    icon: Newspaper,
    category: 'Latest Updates on Tokenization',
  },
  {
    key: 'networks',
    label: 'Networks',
    provider: 'DeFiLlama Chains API',
    icon: Network,
    category: 'Blockchain TVL and Active Addresses',
  },
  {
    key: 'treasuries',
    label: 'U.S. Treasuries',
    provider: 'RPC Reads / Fallback Mock',
    icon: Landmark,
    category: 'Tokenized Treasury TVL (BUIDL, OUSG)',
  },
  {
    key: 'commodities',
    label: 'Commodities',
    provider: 'GoldPrice.Today',
    icon: Activity,
    category: 'Live Gold Prices & Vault Status',
  },
];

const money = (value?: number | null, digits = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

const compactMoney = (value?: number | null) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function PublicAnalytics() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  const [activeTab, setActiveTab] = useState<TabKey>('stablecoins');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('—');

  const [stablecoins, setStablecoins] = useState<{ summary?: any; data: StablecoinItem[] }>({ data: [] });
  const [market, setMarket] = useState<{ summary?: any; data: MarketCoin[] }>({ data: [] });
  const [news, setNews] = useState<{ isFallback?: boolean; fallbackReason?: string; data: NewsItem[] }>({ data: [] });
  const [networks, setNetworks] = useState<{ summary?: any; data: NetworkItem[] }>({ data: [] });
  const [treasuries, setTreasuries] = useState<{ isFallback?: boolean; fallbackReason?: string; summary?: any; data: TreasuryItem[] }>({ data: [] });
  const [commodities, setCommodities] = useState<CommoditiesData | null>(null);
  const [publicLedger, setPublicLedger] = useState<PublicLedgerRecord[]>([]);

  const activeTabMeta = useMemo(() => TABS.find((tab) => tab.key === activeTab), [activeTab]);

  useEffect(() => {
    if (!authLoaded) return;
    if (!isSignedIn) {
      router.replace('/public/login');
    }
  }, [authLoaded, isSignedIn, router]);

  const fetchDashboard = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const endpoints = [
        '/api/dashboard/stablecoins',
        '/api/dashboard/market-overview',
        '/api/dashboard/news',
        '/api/dashboard/networks',
        '/api/dashboard/us-treasuries',
        '/api/dashboard/commodities',
        '/api/blockchain/public/records',
      ];

      const responses = await Promise.all(
        endpoints.map((path) =>
          fetch(`${backendUrl}${path}`).then(async (res) => {
            const body = await res.json();
            if (!res.ok) {
              throw new Error(body?.message || `Request failed: ${path}`);
            }
            return body;
          })
        )
      );

      setStablecoins({ summary: responses[0].summary, data: responses[0].data || [] });
      setMarket({ summary: responses[1].summary, data: responses[1].data || [] });
      setNews({
        isFallback: responses[2].isFallback,
        fallbackReason: responses[2].fallbackReason,
        data: responses[2].data || [],
      });
      setNetworks({ summary: responses[3].summary, data: responses[3].data || [] });
      setTreasuries({
        isFallback: responses[4].isFallback,
        fallbackReason: responses[4].fallbackReason,
        summary: responses[4].summary,
        data: responses[4].data || [],
      });
      setCommodities(responses[5]?.data || null);
      setPublicLedger(responses[6]?.data || []);

      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    fetchDashboard(false);
    const interval = setInterval(() => fetchDashboard(true), 30000);
    return () => clearInterval(interval);
  }, [backendUrl, authLoaded, isSignedIn]);

  const handleLogout = async () => {
    await signOut();
    router.push('/public/login');
  };

  if (!authLoaded) {
    return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-mono">Loading authentication...</div>;
  }
  if (!isSignedIn) {
    return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-mono">Redirecting to login...</div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Head>
        <title>PHENOX | Unified RWA Dashboard</title>
        <meta name="description" content="Stablecoins, RWA markets, tokenization news, chain TVL, treasuries and commodities." />
      </Head>

      <header className="border-b border-[#FFD700]/10 px-6 py-4 flex items-center justify-between sticky top-0 z-20 bg-[#050505]/95 backdrop-blur">
        <div className="flex items-center gap-5">
          <Link href="/public" className="font-mono font-bold text-[#FFD700] tracking-widest text-lg">
            &gt;_ PHENOX
          </Link>
          <span className="text-gray-600 hidden md:block">|</span>
          <span className="text-gray-400 text-sm hidden md:block font-mono">Unified Dashboard Data Terminal</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 font-mono hidden lg:block">
            {user?.primaryEmailAddress?.emailAddress || 'Authenticated User'}
          </span>
          <button
            onClick={() => fetchDashboard(false)}
            className="text-xs border border-[#FFD700]/30 text-[#FFD700] px-3 py-1.5 rounded hover:bg-[#FFD700]/10 transition-all font-mono flex items-center gap-2"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="text-xs border border-red-400/40 text-red-300 px-3 py-1.5 rounded hover:bg-red-400/10 transition-all font-mono"
          >
            Logout
          </button>
          <span className="text-xs text-gray-500 font-mono hidden md:flex items-center gap-2">
            Last updated: {lastUpdated}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard label="Stablecoin Market Cap (Tracked)" value={compactMoney(stablecoins.summary?.totalMarketCapUsd)} />
          <MetricCard label="RWA Market Cap (Tracked)" value={compactMoney(market.summary?.rwaCombinedMarketCapUsd)} />
          <MetricCard label="Tokenized Treasury TVL" value={compactMoney(treasuries.summary?.totalTvlUsd)} />
        </section>

        <section className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Public Ledger Records (Admin Sync)</h2>
            <span className="text-xs font-mono text-gray-500">
              Auto-refreshed from <span className="text-[#FFD700]">/api/blockchain/public/records</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Batch ID', 'Weight', 'Purity', 'Location', 'Chain Status', 'Updated'].map((head) => (
                    <th key={head} className="text-left px-3 py-3 text-xs text-gray-500 uppercase font-mono">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {publicLedger.map((item) => (
                  <tr key={item.batchId} className="border-b border-white/[0.04]">
                    <td className="px-3 py-3 font-semibold text-[#FFD700]">{item.batchId}</td>
                    <td className="px-3 py-3">{Number(item.weight).toLocaleString()} g</td>
                    <td className="px-3 py-3">{item.purity}K</td>
                    <td className="px-3 py-3">{item.location}</td>
                    <td className="px-3 py-3">{item.onChain?.status || 'PENDING'}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
                {!publicLedger.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                      No public records yet. Add a public batch from admin panel to see it here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl p-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
                    active
                      ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                      : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white/[0.02] border border-[#FFD700]/10 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">{activeTabMeta?.label}</h2>
              <p className="text-xs text-gray-500 font-mono mt-1">{activeTabMeta?.category}</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-gray-600 font-mono">Provider</div>
              <div className="text-sm text-[#FFD700] font-semibold">{activeTabMeta?.provider}</div>
            </div>
          </div>

          {isLoading && <div className="text-sm text-gray-400 font-mono">Loading live data...</div>}
          {!isLoading && error && <div className="text-sm text-red-400 font-mono">{error}</div>}

          {!isLoading && !error && (
            <>
              {activeTab === 'stablecoins' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Asset', 'Market Cap', 'Supply', 'Peg Variance', 'Top Chains'].map((head) => (
                          <th key={head} className="text-left px-3 py-3 text-xs text-gray-500 uppercase font-mono">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stablecoins.data.map((item) => (
                        <tr key={item.symbol} className="border-b border-white/[0.04]">
                          <td className="px-3 py-3">
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.symbol}</div>
                          </td>
                          <td className="px-3 py-3">{money(item.marketCapUsd)}</td>
                          <td className="px-3 py-3">{item.totalSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-3 py-3 text-[#39FF14]">{item.pegVariancePct.toFixed(3)}%</td>
                          <td className="px-3 py-3 text-xs text-gray-400">
                            {(item.chainDistribution || [])
                              .slice(0, 2)
                              .map((chain) => `${chain.chain} (${chain.sharePct.toFixed(1)}%)`)
                              .join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'market' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <MetricCard label="Global Crypto Market Cap" value={compactMoney(market.summary?.globalCryptoMarketCapUsd)} />
                    <MetricCard label="RWA 24h Volume (Tracked)" value={compactMoney(market.summary?.rwaCombined24hVolumeUsd)} />
                    <MetricCard label="BTC Dominance" value={`${Number(market.summary?.btcDominancePct || 0).toFixed(2)}%`} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {['Token', 'Price', 'Market Cap', '24h Volume', '24h Change'].map((head) => (
                            <th key={head} className="text-left px-3 py-3 text-xs text-gray-500 uppercase font-mono">
                              {head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {market.data.map((coin) => (
                          <tr key={coin.id} className="border-b border-white/[0.04]">
                            <td className="px-3 py-3">
                              <div className="font-semibold">{coin.name}</div>
                              <div className="text-xs text-gray-500">{coin.symbol}</div>
                            </td>
                            <td className="px-3 py-3">{money(coin.currentPriceUsd, 4)}</td>
                            <td className="px-3 py-3">{compactMoney(coin.marketCapUsd)}</td>
                            <td className="px-3 py-3">{compactMoney(coin.volume24hUsd)}</td>
                            <td className={`px-3 py-3 ${coin.priceChange24hPct >= 0 ? 'text-[#39FF14]' : 'text-[#FF4D4D]'}`}>
                              {coin.priceChange24hPct.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'news' && (
                <div className="space-y-3">
                  {news.isFallback && (
                    <div className="text-xs font-mono text-amber-400 border border-amber-400/30 rounded p-2">
                      Live RSS fallback active: {news.fallbackReason}
                    </div>
                  )}
                  {news.data.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block border border-white/10 rounded-lg p-4 hover:border-[#FFD700]/30 transition-all"
                    >
                      <div className="text-white font-semibold mb-2">{item.title}</div>
                      <div className="text-xs text-gray-500 font-mono flex flex-wrap gap-3">
                        <span>{item.source}</span>
                        <span>{new Date(item.publishedAt).toLocaleString()}</span>
                        <span>{(item.categories || []).join(', ') || 'General'}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {activeTab === 'networks' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Network', 'Chain ID', 'TVL', 'Active Addresses (24h)', 'Note'].map((head) => (
                          <th key={head} className="text-left px-3 py-3 text-xs text-gray-500 uppercase font-mono">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {networks.data.map((item) => (
                        <tr key={item.name} className="border-b border-white/[0.04]">
                          <td className="px-3 py-3 font-semibold">{item.name}</td>
                          <td className="px-3 py-3">{item.chainId ?? '—'}</td>
                          <td className="px-3 py-3">{item.tvlUsd == null ? '—' : compactMoney(item.tvlUsd)}</td>
                          <td className="px-3 py-3">{item.activeAddresses24h ?? 'N/A'}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{item.activeAddressesSource || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'treasuries' && (
                <div className="space-y-3">
                  {treasuries.isFallback && (
                    <div className="text-xs font-mono text-amber-400 border border-amber-400/30 rounded p-2">
                      RPC fallback simulator active: {treasuries.fallbackReason}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {['Asset', 'Contract', 'Supply', 'Price', 'TVL'].map((head) => (
                            <th key={head} className="text-left px-3 py-3 text-xs text-gray-500 uppercase font-mono">
                              {head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {treasuries.data.map((item) => (
                          <tr key={item.symbol} className="border-b border-white/[0.04]">
                            <td className="px-3 py-3">
                              <div className="font-semibold">{item.name}</div>
                              <div className="text-xs text-gray-500">{item.symbol}</div>
                            </td>
                            <td className="px-3 py-3 text-xs font-mono">{item.contract}</td>
                            <td className="px-3 py-3">{item.totalSupply.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-3">{money(item.priceUsd, 4)}</td>
                            <td className="px-3 py-3">{compactMoney(item.tvlUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'commodities' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <MetricCard label="Gold Price (USD/g)" value={money(commodities?.usd, 2)} />
                  <MetricCard label="Gold Price (INR/g)" value={`₹${Number(commodities?.inr || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                  <MetricCard label="Vault Status" value={commodities?.vaultStatus || 'Verified'} />
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-[#FFD700]/10 px-8 py-6 text-center text-gray-600 text-xs font-mono">
        PHENOX Dashboard Matrix wired to live provider endpoints with 30s refresh
      </footer>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-[#FFD700]/10 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">{label}</div>
      <div className="text-xl font-bold text-white flex items-center gap-2">
        <TrendingUp size={15} className="text-[#FFD700]" />
        {value}
      </div>
    </div>
  );
}
