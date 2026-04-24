require('dotenv').config();

const express = require('express');

const cors = require('cors');
const axios = require('axios');
const blockchainRoutes = require('./routes/blockchainRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const goldRoutes = require('./routes/gold');
const requestLogger = require('./middlewares/requestLogger');
const errorHandler = require('./middlewares/errorHandler');
const { notFoundHandler } = require('./middlewares/errorHandler');
const { requireAdminAuth, validateAdminAuthConfig } = require('./middlewares/adminAuth');
const logger = require('./utils/logger');
const db = require('./db');
const { initBlockchain } = require('./services/blockchain');
const { startIndexer, stopIndexer } = require('./services/indexer');
const { getHealthSnapshot } = require('./services/health');
const { fetchGoldPrice, getCurrentGoldPrice, startPriceScheduler, stopPriceScheduler } = require('./services/price');

const app = express();
const corsOrigins = String(process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    corsOrigins.includes('*')
      ? {}
      : {
          origin: (origin, callback) => {
            if (!origin || corsOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('CORS origin not allowed'));
          },
        }
  )
);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use('/api', certificateRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/v1/gold', goldRoutes);

const HTTP_TIMEOUT_MS = Number(process.env.DASHBOARD_HTTP_TIMEOUT_MS || 12000);
const CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 45000);
const FALLBACK_ETH_RPC_URL = 'https://ethereum.publicnode.com';

const TREASURY_TOKENS = [
  {
    key: 'BUIDL',
    name: 'BlackRock USD Institutional Digital Liquidity Fund',
    address: (process.env.BUIDL_TOKEN_ADDRESS || '0x7712c34205737192402172409a8f7ccef8aa2aec').toLowerCase(),
    coingeckoId: 'blackrock-usd-institutional-digital-liquidity-fund',
  },
  {
    key: 'OUSG',
    name: 'Ondo Short-Term US Government Treasuries',
    address: (process.env.OUSG_TOKEN_ADDRESS || '0x1b19c19393e2d034d8ff31ff34c81252fcbbee92').toLowerCase(),
    coingeckoId: 'ousg',
  },
];

const dashboardCache = new Map();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const fetchJson = async (url, options = {}) => {
  const response = await axios.get(url, {
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PHENOX-Dashboard/1.0',
      ...options.headers,
    },
    ...options,
  });
  return response.data;
};

const fetchText = async (url, options = {}) => {
  const response = await axios.get(url, {
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      Accept: '*/*',
      'User-Agent': 'PHENOX-Dashboard/1.0',
      ...options.headers,
    },
    responseType: 'text',
    ...options,
  });
  return String(response.data || '');
};

const withCache = async (cacheKey, fetcher, ttl = CACHE_TTL_MS) => {
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);
  if (cached && now - cached.timestamp < ttl) {
    return cached.payload;
  }
  const payload = await fetcher();
  dashboardCache.set(cacheKey, { timestamp: now, payload });
  return payload;
};

const OUNCE_TO_GRAM = 31.1034768;

const getStaticGoldPriceSnapshot = () => {
  const usdPerGram = 64.0;
  const usdInr = 83.0;
  return {
    usd: usdPerGram,
    inr: usdPerGram * usdInr,
    usdPerOunce: usdPerGram * OUNCE_TO_GRAM,
    usdInr,
    source: 'Static fallback',
    timestamp: Date.now(),
  };
};

const parseCsvQuote = (csvText) => {
  const lines = String(csvText || '').trim().split('\n');
  if (lines.length < 2) throw new Error('CSV quote is missing data row');
  const row = lines[1].split(',').map((value) => value.trim());
  return {
    symbol: row[0],
    date: row[1],
    time: row[2],
    open: toSafeNumber(row[3]),
    high: toSafeNumber(row[4]),
    low: toSafeNumber(row[5]),
    close: toSafeNumber(row[6]),
  };
};

const getLiveGoldPriceSnapshot = async () => {
  const [xauCsv, fxCsv] = await Promise.all([
    fetchText('https://stooq.com/q/l/?s=xauusd&f=sd2t2ohlcv&h&e=csv'),
    fetchText('https://stooq.com/q/l/?s=usdinr&f=sd2t2ohlcv&h&e=csv'),
  ]);

  const xauQuote = parseCsvQuote(xauCsv);
  const fxQuote = parseCsvQuote(fxCsv);
  if (!xauQuote.close || !fxQuote.close) {
    throw new Error('Live quote returned invalid close value');
  }

  const usdPerOunce = xauQuote.close;
  const usdPerGram = usdPerOunce / OUNCE_TO_GRAM;
  const usdInr = fxQuote.close;
  const inrPerGram = usdPerGram * usdInr;

  return {
    usd: usdPerGram,
    inr: inrPerGram,
    usdPerOunce,
    usdInr,
    source: 'Stooq live quotes (XAUUSD + USDINR)',
    quoteTimestamp: `${xauQuote.date} ${xauQuote.time} UTC`,
    timestamp: Date.now(),
  };
};

const getLiveIndiaRetailGoldSnapshot = async () => {
  const html = await fetchText('https://goldmeter.in/');
  const normalized = htmlDecode(html);

  const perGram24kMatch = normalized.match(/₹\s*([\d,]+)\s*per gram for 24K/i);
  const updatedMatch = normalized.match(/Verified from IBJA\|([^|]+)\|Source: GoldMeter\.in/i);

  if (!perGram24kMatch) {
    throw new Error('GoldMeter page did not expose the India 24K per gram rate.');
  }

  const retailInrPerGram = toSafeNumber(String(perGram24kMatch[1]).replace(/,/g, ''));
  if (!retailInrPerGram) {
    throw new Error('India 24K retail rate parsed as invalid.');
  }

  return {
    inr: retailInrPerGram,
    source: 'GoldMeter India 24K retail benchmark',
    sourceUrl: 'https://goldmeter.in/',
    quoteTimestamp: updatedMatch ? updatedMatch[1].trim() : '',
    timestamp: Date.now(),
  };
};

const htmlDecode = (raw = '') =>
  String(raw)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const extractTag = (block, tag) => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return htmlDecode(match?.[1] || '');
};

const parseRssItems = (xml, sourceLabel) => {
  const blocks = String(xml || '').match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block, index) => {
    const title = extractTag(block, 'title');
    const url = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const publishedRaw = extractTag(block, 'pubDate');
    const publishedDate = publishedRaw ? new Date(publishedRaw) : new Date();
    const publishedAt = Number.isNaN(publishedDate.getTime()) ? new Date().toISOString() : publishedDate.toISOString();
    const textBlob = `${title} ${description}`.toLowerCase();
    const categories = [
      ...(textBlob.includes('rwa') || textBlob.includes('tokeniz') ? ['RWA'] : []),
      ...(textBlob.includes('gold') || textBlob.includes('xau') ? ['Gold'] : []),
      ...(textBlob.includes('stablecoin') || textBlob.includes('usdc') || textBlob.includes('usdt') ? ['Stablecoin'] : []),
    ];

    return {
      id: `${sourceLabel.toLowerCase().replace(/\s+/g, '-')}-${index}-${Buffer.from(title || `${index}`).toString('hex').slice(0, 12)}`,
      title: title || 'Untitled',
      url,
      source: sourceLabel,
      body: description,
      categories: categories.length ? categories : ['General'],
      imageUrl: '',
      publishedAt,
    };
  });
};

const getLiveNewsFallback = async (limit, categories) => {
  const query = String(categories || 'RWA,Gold,Stablecoin')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .join(' OR ');

  const feeds = [
    {
      label: 'Google News',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`(${query})`)}&hl=en-US&gl=US&ceid=US:en`,
    },
    {
      label: 'CoinDesk RSS',
      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    },
  ];

  const settled = await Promise.allSettled(
    feeds.map(async (feed) => ({
      label: feed.label,
      xml: await fetchText(feed.url),
    }))
  );

  const merged = settled.flatMap((item) => {
    if (item.status !== 'fulfilled') return [];
    return parseRssItems(item.value.xml, item.value.label);
  });

  const keywords = String(categories || '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const filtered = merged.filter((entry) => {
    if (!keywords.length) return true;
    const text = `${entry.title} ${entry.body} ${(entry.categories || []).join(' ')}`.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  });

  const deduped = [];
  const seen = new Set();
  for (const item of filtered) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const sorted = deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return sorted.slice(0, limit);
};

const getRpcUrl = () => process.env.ETHEREUM_RPC_URL || FALLBACK_ETH_RPC_URL;

const makeRpcCall = async (rpcUrl, payload) => {
  const response = await axios.post(rpcUrl, payload, {
    timeout: HTTP_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.data?.error) {
    throw new Error(response.data.error.message || 'RPC request failed');
  }
  return response.data?.result;
};

const hexToBigInt = (hexValue) => {
  if (!hexValue || hexValue === '0x') return 0n;
  return BigInt(hexValue);
};

const bigIntToFloat = (rawValue, decimals, precision = 8) => {
  const scale = 10n ** BigInt(decimals);
  const whole = rawValue / scale;
  const fraction = rawValue % scale;
  const fractionPadded = fraction.toString().padStart(decimals, '0').slice(0, precision);
  const value = Number(`${whole.toString()}.${fractionPadded || '0'}`);
  return Number.isFinite(value) ? value : 0;
};

const readErc20Supply = async (rpcUrl, tokenAddress) => {
  const [totalSupplyHex, decimalsHex] = await Promise.all([
    makeRpcCall(rpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: tokenAddress, data: '0x18160ddd' }, 'latest'],
    }),
    makeRpcCall(rpcUrl, {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_call',
      params: [{ to: tokenAddress, data: '0x313ce567' }, 'latest'],
    }),
  ]);

  const decimals = Number(hexToBigInt(decimalsHex));
  const raw = hexToBigInt(totalSupplyHex);
  return {
    decimals,
    raw: raw.toString(),
    supply: bigIntToFloat(raw, decimals),
  };
};

const mockTreasuryData = (reason) => {
  const items = [
    {
      symbol: 'BUIDL',
      name: 'BlackRock USD Institutional Digital Liquidity Fund',
      contract: TREASURY_TOKENS[0].address,
      decimals: 6,
      totalSupply: 2001290941,
      rawTotalSupply: '2001290941000000',
      priceUsd: 1.0,
      tvlUsd: 2001290941,
      chain: 'Ethereum',
    },
    {
      symbol: 'OUSG',
      name: 'Ondo Short-Term US Government Treasuries',
      contract: TREASURY_TOKENS[1].address,
      decimals: 18,
      totalSupply: 6282578,
      rawTotalSupply: '6282578000000000000000000',
      priceUsd: 114.73,
      tvlUsd: 720675516,
      chain: 'Ethereum',
    },
  ];

  return {
    success: true,
    provider: 'RPC Calls (fallback simulator)',
    isFallback: true,
    fallbackReason: reason,
    timestamp: new Date().toISOString(),
    summary: {
      trackedAssets: items.length,
      totalTvlUsd: items.reduce((sum, item) => sum + item.tvlUsd, 0),
    },
    data: items,
  };
};

const mockStablecoinsData = (symbols, reason) => {
  const defaults = {
    USDT: {
      name: 'Tether USDt',
      marketCapUsd: 110_250_000_000,
      totalSupply: 110_250_000_000,
      pegVariancePct: 0.04,
      chainDistribution: [
        { chain: 'Ethereum', supplyUsd: 51_000_000_000, sharePct: 46.26 },
        { chain: 'Tron', supplyUsd: 46_000_000_000, sharePct: 41.72 },
        { chain: 'Solana', supplyUsd: 7_500_000_000, sharePct: 6.8 },
      ],
    },
    USDC: {
      name: 'USD Coin',
      marketCapUsd: 34_800_000_000,
      totalSupply: 34_800_000_000,
      pegVariancePct: 0.02,
      chainDistribution: [
        { chain: 'Ethereum', supplyUsd: 24_000_000_000, sharePct: 68.97 },
        { chain: 'Base', supplyUsd: 4_300_000_000, sharePct: 12.36 },
        { chain: 'Solana', supplyUsd: 3_900_000_000, sharePct: 11.21 },
      ],
    },
    DAI: {
      name: 'Dai',
      marketCapUsd: 5_300_000_000,
      totalSupply: 5_300_000_000,
      pegVariancePct: 0.08,
      chainDistribution: [
        { chain: 'Ethereum', supplyUsd: 4_100_000_000, sharePct: 77.36 },
        { chain: 'Arbitrum', supplyUsd: 520_000_000, sharePct: 9.81 },
        { chain: 'Polygon', supplyUsd: 310_000_000, sharePct: 5.85 },
      ],
    },
    USDS: {
      name: 'USDS',
      marketCapUsd: 920_000_000,
      totalSupply: 920_000_000,
      pegVariancePct: 0.11,
      chainDistribution: [
        { chain: 'Ethereum', supplyUsd: 670_000_000, sharePct: 72.83 },
        { chain: 'Base', supplyUsd: 110_000_000, sharePct: 11.96 },
        { chain: 'Arbitrum', supplyUsd: 85_000_000, sharePct: 9.24 },
      ],
    },
  };

  const selectedSymbols = (symbols && symbols.length ? symbols : Object.keys(defaults))
    .filter((symbol) => defaults[symbol]);

  const data = selectedSymbols.map((symbol, index) => ({
    id: `stablecoin-fallback-${symbol.toLowerCase()}-${index}`,
    symbol,
    pegType: 'peggedUSD',
    ...defaults[symbol],
  }));

  return {
    success: true,
    provider: 'DeFiLlama Stablecoins API (fallback simulator)',
    isFallback: true,
    fallbackReason: reason,
    timestamp: new Date().toISOString(),
    summary: {
      trackedAssets: data.length,
      totalMarketCapUsd: data.reduce((sum, row) => sum + row.marketCapUsd, 0),
      averagePegVariancePct: data.length
        ? data.reduce((sum, row) => sum + row.pegVariancePct, 0) / data.length
        : 0,
    },
    data,
  };
};

const mockMarketOverviewData = (limit, reason) => {
  const data = [
    {
      id: 'ondo-finance',
      symbol: 'ONDO',
      name: 'Ondo',
      currentPriceUsd: 0.92,
      marketCapUsd: 1_280_000_000,
      fullyDilutedValuationUsd: 9_200_000_000,
      volume24hUsd: 185_000_000,
      priceChange24hPct: 1.84,
      circulatingSupply: 1_391_000_000,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'maker',
      symbol: 'MKR',
      name: 'Maker',
      currentPriceUsd: 2840.15,
      marketCapUsd: 2_420_000_000,
      fullyDilutedValuationUsd: 2_780_000_000,
      volume24hUsd: 96_000_000,
      priceChange24hPct: -0.73,
      circulatingSupply: 852_000,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'pax-gold',
      symbol: 'PAXG',
      name: 'PAX Gold',
      currentPriceUsd: 2324.67,
      marketCapUsd: 610_000_000,
      fullyDilutedValuationUsd: 610_000_000,
      volume24hUsd: 24_000_000,
      priceChange24hPct: 0.42,
      circulatingSupply: 262_000,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'tether-gold',
      symbol: 'XAUT',
      name: 'Tether Gold',
      currentPriceUsd: 2319.11,
      marketCapUsd: 570_000_000,
      fullyDilutedValuationUsd: 570_000_000,
      volume24hUsd: 11_000_000,
      priceChange24hPct: 0.31,
      circulatingSupply: 246_000,
      lastUpdated: new Date().toISOString(),
    },
  ].slice(0, limit);

  return {
    success: true,
    provider: 'CoinGecko API (fallback simulator)',
    isFallback: true,
    fallbackReason: reason,
    endpoint: '/coins/markets?category=real-world-assets-rwa',
    timestamp: new Date().toISOString(),
    summary: {
      rwaAssetsTracked: data.length,
      rwaCombinedMarketCapUsd: data.reduce((sum, row) => sum + row.marketCapUsd, 0),
      rwaCombined24hVolumeUsd: data.reduce((sum, row) => sum + row.volume24hUsd, 0),
      globalCryptoMarketCapUsd: 2_450_000_000_000,
      btcDominancePct: 53.8,
      ethDominancePct: 17.2,
    },
    data,
  };
};

const mockNetworksData = (limit, reason) => {
  const data = [
    {
      name: 'Monad',
      chainId: 10143,
      tokenSymbol: 'MON',
      tvlUsd: null,
      activeAddresses24h: null,
      activeAddressesSource: 'Fallback snapshot for local demo mode',
    },
    {
      name: 'Ethereum',
      chainId: 1,
      tokenSymbol: 'ETH',
      tvlUsd: 58_400_000_000,
      activeAddresses24h: null,
      activeAddressesSource: 'Fallback snapshot for local demo mode',
    },
    {
      name: 'Solana',
      chainId: null,
      tokenSymbol: 'SOL',
      tvlUsd: 7_900_000_000,
      activeAddresses24h: null,
      activeAddressesSource: 'Fallback snapshot for local demo mode',
    },
    {
      name: 'Arbitrum',
      chainId: 42161,
      tokenSymbol: 'ETH',
      tvlUsd: 3_100_000_000,
      activeAddresses24h: null,
      activeAddressesSource: 'Fallback snapshot for local demo mode',
    },
    {
      name: 'Base',
      chainId: 8453,
      tokenSymbol: 'ETH',
      tvlUsd: 2_450_000_000,
      activeAddresses24h: null,
      activeAddressesSource: 'Fallback snapshot for local demo mode',
    },
    {
      name: 'Polygon',
      chainId: 137,
      tokenSymbol: 'POL',
      tvlUsd: 980_000_000,
      activeAddresses24h: null,
      activeAddressesSource: 'Fallback snapshot for local demo mode',
    },
  ].slice(0, limit);

  return {
    success: true,
    provider: 'DeFiLlama Chains API (fallback simulator)',
    isFallback: true,
    fallbackReason: reason,
    endpoint: '/v2/chains',
    timestamp: new Date().toISOString(),
    summary: {
      chainsTracked: data.length,
      combinedTvlUsd: data.reduce((sum, chain) => sum + (toSafeNumber(chain.tvlUsd) || 0), 0),
    },
    data,
  };
};

const mockNewsItems = (limit, reason) => {
  const now = Date.now();
  const templates = [
    {
      id: 'fallback-1',
      title: 'Tokenized Treasury products continue expanding across Ethereum and Solana',
      url: 'https://www.cryptocompare.com/',
      source: 'PHENOX Fallback',
      body: 'CryptoCompare key is missing or blocked, so this dashboard is showing a local fallback feed.',
      categories: ['RWA', 'Stablecoin'],
      imageUrl: '',
      publishedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'fallback-2',
      title: 'Gold-backed tokens remain key bridge between commodities and DeFi liquidity',
      url: 'https://www.cryptocompare.com/',
      source: 'PHENOX Fallback',
      body: 'Configure CRYPTOCOMPARE_API_KEY in backend .env for live tagged market news.',
      categories: ['Gold', 'RWA'],
      imageUrl: '',
      publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'fallback-3',
      title: 'Stablecoin market cap shifts as multi-chain issuance rebalances',
      url: 'https://www.cryptocompare.com/',
      source: 'PHENOX Fallback',
      body: reason || 'Fallback mode is enabled.',
      categories: ['Stablecoin'],
      imageUrl: '',
      publishedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    },
  ];
  return templates.slice(0, limit);
};

// POST /api/log - log admin action with IP
app.post('/api/log', requireAdminAuth, (req, res) => {
  const { action, details } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] Admin ${req.userId} | ${action} | ${details} | IP: ${ip}`);
  res.json({ success: true });
});

// GET /api/gold-price - live commodities source with fallback
app.get('/api/gold-price', async (req, res) => {
  try {
    const current = getCurrentGoldPrice();
    const lastUpdatedMs = current?.lastUpdated ? new Date(current.lastUpdated).getTime() : 0;
    const isStale = !lastUpdatedMs || Number.isNaN(lastUpdatedMs) || Date.now() - lastUpdatedMs > 60_000;
    const live = isStale ? await fetchGoldPrice() : current;
    res.json(live);
  } catch {
    res.json(getCurrentGoldPrice());
  }
});

// Stablecoins: DeFiLlama Stablecoins API
app.get('/api/dashboard/stablecoins', async (req, res) => {
  const symbols = String(req.query.symbols || 'USDT,USDC,DAI,USDS')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  try {
    const payload = await withCache(`stablecoins:${symbols.join(',')}`, async () => {
      const raw = await fetchJson('https://stablecoins.llama.fi/stablecoins');
      const assets = Array.isArray(raw?.peggedAssets) ? raw.peggedAssets : [];
      const filteredAssets = assets.filter((asset) => symbols.includes(String(asset.symbol || '').toUpperCase()));
      const selectedAssets = filteredAssets.length ? filteredAssets : assets.slice(0, 8);

      const rows = selectedAssets.map((asset) => {
        const price = toSafeNumber(asset.price || 1);
        const supplyUsd = toSafeNumber(asset?.circulating?.peggedUSD);
        const totalSupply = price > 0 ? supplyUsd / price : supplyUsd;
        const pegVariancePct = Math.abs(price - 1) * 100;
        const chainCirculating = asset.chainCirculating || {};
        const chainDistribution = Object.entries(chainCirculating)
          .map(([chain, values]) => {
            const chainSupplyUsd = toSafeNumber(values?.current?.peggedUSD);
            return {
              chain,
              supplyUsd: chainSupplyUsd,
              sharePct: supplyUsd > 0 ? (chainSupplyUsd / supplyUsd) * 100 : 0,
            };
          })
          .filter((row) => row.supplyUsd > 0)
          .sort((a, b) => b.supplyUsd - a.supplyUsd)
          .slice(0, 6);

        return {
          id: asset.id,
          name: asset.name,
          symbol: asset.symbol,
          pegType: asset.pegType,
          price,
          marketCapUsd: supplyUsd,
          totalSupply,
          pegVariancePct,
          chainDistribution,
        };
      });

      return {
        success: true,
        provider: 'DeFiLlama Stablecoins API',
        timestamp: new Date().toISOString(),
        summary: {
          trackedAssets: rows.length,
          totalMarketCapUsd: rows.reduce((sum, row) => sum + row.marketCapUsd, 0),
          averagePegVariancePct: rows.length
            ? rows.reduce((sum, row) => sum + row.pegVariancePct, 0) / rows.length
            : 0,
        },
        data: rows,
      };
    });

    res.json(payload);
  } catch (error) {
    res.json(mockStablecoinsData(symbols, error.message));
  }
});

// Market Overview: CoinGecko /coins/markets category=real-world-assets-rwa
app.get('/api/dashboard/market-overview', async (req, res) => {
  const limit = clamp(Number(req.query.limit || 15), 5, 50);

  try {
    const payload = await withCache(`market-overview:${limit}`, async () => {
      const [markets, globalData] = await Promise.all([
        fetchJson('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            category: 'real-world-assets-rwa',
            order: 'market_cap_desc',
            per_page: limit,
            page: 1,
            sparkline: false,
            price_change_percentage: '24h',
          },
        }),
        fetchJson('https://api.coingecko.com/api/v3/global'),
      ]);

      const data = Array.isArray(markets)
        ? markets.map((coin) => ({
          id: coin.id,
          symbol: String(coin.symbol || '').toUpperCase(),
          name: coin.name,
          currentPriceUsd: toSafeNumber(coin.current_price),
          marketCapUsd: toSafeNumber(coin.market_cap),
          fullyDilutedValuationUsd: toSafeNumber(coin.fully_diluted_valuation),
          volume24hUsd: toSafeNumber(coin.total_volume),
          priceChange24hPct: toSafeNumber(coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h),
          circulatingSupply: toSafeNumber(coin.circulating_supply),
          lastUpdated: coin.last_updated,
        }))
        : [];

      return {
        success: true,
        provider: 'CoinGecko API (Free Tier)',
        endpoint: '/coins/markets?category=real-world-assets-rwa',
        timestamp: new Date().toISOString(),
        summary: {
          rwaAssetsTracked: data.length,
          rwaCombinedMarketCapUsd: data.reduce((sum, row) => sum + row.marketCapUsd, 0),
          rwaCombined24hVolumeUsd: data.reduce((sum, row) => sum + row.volume24hUsd, 0),
          globalCryptoMarketCapUsd: toSafeNumber(globalData?.data?.total_market_cap?.usd),
          btcDominancePct: toSafeNumber(globalData?.data?.market_cap_percentage?.btc),
          ethDominancePct: toSafeNumber(globalData?.data?.market_cap_percentage?.eth),
        },
        data,
      };
    });

    res.json(payload);
  } catch (error) {
    res.json(mockMarketOverviewData(limit, error.message));
  }
});

// News: CryptoCompare with fallback if key is unavailable
app.get('/api/dashboard/news', async (req, res) => {
  const limit = clamp(Number(req.query.limit || 8), 3, 30);
  const categories = String(req.query.categories || 'RWA,Gold,Stablecoin');
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

  try {
    const payload = await withCache(`news:${categories}:${apiKey ? 'key' : 'nokey'}:${limit}`, async () => {
      if (!apiKey) {
        const fallbackLive = await getLiveNewsFallback(limit, categories);
        if (!fallbackLive.length) {
          throw new Error('No live fallback news available');
        }
        return {
          success: true,
          provider: 'CryptoCompare News API (live RSS fallback)',
          isFallback: true,
          fallbackReason: 'CRYPTOCOMPARE_API_KEY not configured; using live RSS feeds',
          timestamp: new Date().toISOString(),
          data: fallbackLive,
        };
      }

      const raw = await fetchJson('https://min-api.cryptocompare.com/data/v2/news/', {
        params: {
          lang: 'EN',
          categories,
          api_key: apiKey,
        },
      });

      if (raw?.Response !== 'Success' || !Array.isArray(raw.Data)) {
        throw new Error(raw?.Message || 'Unexpected CryptoCompare response');
      }

      return {
        success: true,
        provider: 'CryptoCompare News API',
        isFallback: false,
        timestamp: new Date().toISOString(),
        data: raw.Data.slice(0, limit).map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          source: item.source,
          body: item.body,
          categories: item.categories ? String(item.categories).split('|') : [],
          imageUrl: item.imageurl,
          publishedAt: new Date(item.published_on * 1000).toISOString(),
        })),
      };
    }, 60_000);

    res.json(payload);
  } catch (error) {
    let fallbackItems = [];
    try {
      fallbackItems = await getLiveNewsFallback(limit, categories);
    } catch {
      fallbackItems = [];
    }

    res.json({
      success: true,
      provider: 'CryptoCompare News API (live RSS fallback)',
      isFallback: true,
      fallbackReason: error.message,
      timestamp: new Date().toISOString(),
      data: fallbackItems.length ? fallbackItems : mockNewsItems(limit, error.message),
    });
  }
});

// Networks: DeFiLlama Chains API
app.get('/api/dashboard/networks', async (req, res) => {
  const limit = clamp(Number(req.query.limit || 12), 6, 25);
  const preferredChains = ['Monad', 'Ethereum', 'Solana', 'Arbitrum', 'Base', 'Polygon'];

  try {
    const payload = await withCache(`networks:${limit}`, async () => {
      const raw = await fetchJson('https://api.llama.fi/v2/chains');
      const chains = Array.isArray(raw) ? raw : [];
      const sorted = [...chains].sort((a, b) => toSafeNumber(b.tvl) - toSafeNumber(a.tvl));

      const preferred = preferredChains
        .map((name) => sorted.find((chain) => String(chain.name || '').toLowerCase() === name.toLowerCase()))
        .filter(Boolean);

      const extra = sorted
        .filter((chain) => !preferred.some((target) => target.name === chain.name))
        .slice(0, Math.max(0, limit - preferred.length));

      const selected = [...preferred, ...extra];
      const foundMonad = selected.some((chain) => String(chain.name || '').toLowerCase() === 'monad');

      const data = selected.map((chain) => ({
        name: chain.name,
        chainId: chain.chainId ?? null,
        tokenSymbol: chain.tokenSymbol ?? null,
        tvlUsd: toSafeNumber(chain.tvl),
        activeAddresses24h: null,
        activeAddressesSource: 'Not provided by /v2/chains free endpoint',
      }));

      if (!foundMonad) {
        data.unshift({
          name: 'Monad',
          chainId: null,
          tokenSymbol: null,
          tvlUsd: null,
          activeAddresses24h: null,
          activeAddressesSource: 'Chain not present in current DeFiLlama /v2/chains snapshot',
        });
      }

      return {
        success: true,
        provider: 'DeFiLlama Chains API',
        endpoint: '/v2/chains',
        timestamp: new Date().toISOString(),
        summary: {
          chainsTracked: data.length,
          combinedTvlUsd: data.reduce((sum, chain) => sum + (toSafeNumber(chain.tvlUsd) || 0), 0),
        },
        data,
      };
    });

    res.json(payload);
  } catch (error) {
    res.json(mockNetworksData(limit, error.message));
  }
});

// U.S. Treasuries: RPC reads of tokenized treasury contracts (with fallback simulator)
app.get('/api/dashboard/us-treasuries', async (req, res) => {
  const rpcUrl = getRpcUrl();

  try {
    const payload = await withCache('us-treasuries', async () => {
      const priceResponse = await fetchJson('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: TREASURY_TOKENS.map((token) => token.coingeckoId).join(','),
          vs_currencies: 'usd',
        },
      });

      const data = [];
      for (const token of TREASURY_TOKENS) {
        const supplyInfo = await readErc20Supply(rpcUrl, token.address);
        const priceUsd = toSafeNumber(priceResponse?.[token.coingeckoId]?.usd || 1);
        data.push({
          symbol: token.key,
          name: token.name,
          contract: token.address,
          chain: 'Ethereum',
          decimals: supplyInfo.decimals,
          rawTotalSupply: supplyInfo.raw,
          totalSupply: supplyInfo.supply,
          priceUsd,
          tvlUsd: supplyInfo.supply * priceUsd,
        });
      }

      return {
        success: true,
        provider: 'RPC Calls (ERC-20 read) with CoinGecko pricing',
        isFallback: false,
        rpcUrl,
        timestamp: new Date().toISOString(),
        summary: {
          trackedAssets: data.length,
          totalTvlUsd: data.reduce((sum, item) => sum + item.tvlUsd, 0),
        },
        data,
      };
    }, 60_000);

    res.json(payload);
  } catch (error) {
    res.json(mockTreasuryData(error.message));
  }
});

// Commodities: live gold feed with resilient fallback
app.get('/api/dashboard/commodities', async (req, res) => {
  try {
    const [spot, retailIndia] = await Promise.all([
      withCache('commodities-live-spot', getLiveGoldPriceSnapshot, 60_000),
      withCache('commodities-live-india-retail', getLiveIndiaRetailGoldSnapshot, 60_000),
    ]);

    res.json({
      success: true,
      provider: 'Stooq spot + GoldMeter India 24K benchmark',
      isFallback: false,
      timestamp: new Date().toISOString(),
      data: {
        ...spot,
        india24kRetailInr: retailIndia.inr,
        india24kRetailSource: retailIndia.source,
        india24kRetailUpdatedAt: retailIndia.quoteTimestamp,
        vaultStatus: 'Verified',
        reserveLocation: 'Primary Vault Cluster',
      },
    });
  } catch (error) {
    res.json({
      success: true,
      provider: 'Stooq spot + GoldMeter India 24K benchmark',
      isFallback: true,
      fallbackReason: error.message,
      timestamp: new Date().toISOString(),
      data: {
        ...getStaticGoldPriceSnapshot(),
        india24kRetailInr: 15295,
        india24kRetailSource: 'GoldMeter India 24K retail benchmark',
        india24kRetailUpdatedAt: '24 April 2026, 3:41 pm',
        vaultStatus: 'Verified',
        reserveLocation: 'Primary Vault Cluster',
      },
    });
  }
});

app.get('/health', async (req, res, next) => {
  try {
    const health = await getHealthSnapshot();
    return res.status(health.ok ? 200 : 503).json(health);
  } catch (error) {
    return next(error);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
let server = null;

const bootstrap = async () => {
  validateAdminAuthConfig();
  startPriceScheduler();

  try {
    await initBlockchain();
    await startIndexer();
  } catch (error) {
    logger.warn('Blockchain indexer disabled at startup: %s', error.message);
  }

  server = app.listen(PORT, () => {
    logger.info('Backend running on port %d', Number(PORT));
  });
};

const shutdown = async (signal) => {
  logger.info('%s received, shutting down backend', signal);
  stopIndexer();
  stopPriceScheduler();

  await db.closePool().catch((error) => {
    logger.warn('PostgreSQL close failed during shutdown: %s', error.message);
  });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

bootstrap().catch((error) => {
  logger.error('Fatal startup error: %s', error.message);
  process.exit(1);
});
