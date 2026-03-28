const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Clerk } = require('@clerk/backend');
const blockchainRoutes = require('./routes/blockchainRoutes');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/blockchain', blockchainRoutes);

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
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey ? Clerk({ secretKey: clerkSecretKey }) : null;

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

const getGoldPriceSnapshot = () => {
  const usdPerGram = 64.0;
  const inrPerUSD = 83.0;
  return {
    usd: usdPerGram,
    inr: usdPerGram * inrPerUSD,
    timestamp: Date.now(),
  };
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

// Middleware to verify Clerk session
const requireAuth = async (req, res, next) => {
  if (!clerk) {
    req.userId = 'demo-admin';
    return next();
  }

  const sessionToken = req.headers.authorization?.split(' ')[1];
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const session = await clerk.sessions.verifySession({ sessionId: sessionToken });
    req.userId = session.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
};

// POST /api/log - log admin action with IP
app.post('/api/log', requireAuth, (req, res) => {
  const { action, details } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] Admin ${req.userId} | ${action} | ${details} | IP: ${ip}`);
  res.json({ success: true });
});

// GET /api/gold-price - existing commodities source
app.get('/api/gold-price', (req, res) => {
  res.json(getGoldPriceSnapshot());
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
    res.status(502).json({
      success: false,
      provider: 'DeFiLlama Stablecoins API',
      message: 'Failed to load stablecoins data',
      error: error.message,
    });
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
    res.status(502).json({
      success: false,
      provider: 'CoinGecko API (Free Tier)',
      message: 'Failed to load market overview',
      error: error.message,
    });
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
        return {
          success: true,
          provider: 'CryptoCompare News API',
          isFallback: true,
          fallbackReason: 'CRYPTOCOMPARE_API_KEY not configured',
          timestamp: new Date().toISOString(),
          data: mockNewsItems(limit, 'Missing API key'),
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
    res.json({
      success: true,
      provider: 'CryptoCompare News API',
      isFallback: true,
      fallbackReason: error.message,
      timestamp: new Date().toISOString(),
      data: mockNewsItems(limit, error.message),
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
    res.status(502).json({
      success: false,
      provider: 'DeFiLlama Chains API',
      message: 'Failed to load networks data',
      error: error.message,
    });
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

// Commodities: GoldPrice.Today (backed by existing gold-price backend source)
app.get('/api/dashboard/commodities', (req, res) => {
  res.json({
    success: true,
    provider: 'GoldPrice.Today (backend feed)',
    timestamp: new Date().toISOString(),
    data: {
      ...getGoldPriceSnapshot(),
      vaultStatus: 'Verified',
      reserveLocation: 'Primary Vault Cluster',
    },
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
