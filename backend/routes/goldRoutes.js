const express = require('express');
const router = express.Router();

// ── Simple in-memory cache ──────────────────────────────────────────────────
let priceCache = null;
let priceCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (matches GoldPrice.Today update freq)

async function fetchLiveGoldPrice() {
  const now = Date.now();
  if (priceCache && now - priceCacheTime < CACHE_TTL) {
    return priceCache;
  }

  try {
    // Dynamic import for node-fetch compatibility
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
    const response = await fetch('https://GoldPrice.Today/api.php?data=live', {
      headers: { 'User-Agent': 'PHENOX-Dashboard/1.0' },
      timeout: 8000,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // GoldPrice.Today returns price per troy ounce (31.1035g)
    const usdPerOz  = parseFloat(data?.USD?.gold_price || data?.price_usd || 3200);
    const inrPerOz  = parseFloat(data?.INR?.gold_price || usdPerOz * 83.7);
    const usdPerGram = usdPerOz / 31.1035;
    const inrPerGram = inrPerOz / 31.1035;

    priceCache = {
      usdPerOz: +usdPerOz.toFixed(2),
      inrPerOz: +inrPerOz.toFixed(2),
      usdPerGram: +usdPerGram.toFixed(4),
      inrPerGram: +inrPerGram.toFixed(2),
      change24h: data?.USD?.change_24h || 0,
      changePct24h: data?.USD?.change_pct_24h || 0,
      lastUpdate: new Date().toISOString(),
      source: 'goldprice.today',
    };
    priceCacheTime = now;
    return priceCache;
  } catch (err) {
    console.warn('[goldRoutes] Live price fetch failed, using fallback:', err.message);
    // Fallback: realistic 2025 gold price
    return {
      usdPerOz: 3198.50,
      inrPerOz: 267622.95,
      usdPerGram: 102.83,
      inrPerGram: 8604.27,
      change24h: 12.4,
      changePct24h: 0.39,
      lastUpdate: new Date().toISOString(),
      source: 'fallback',
    };
  }
}

// ── BUILD 7D / 30D / 1Y historical data from live price ────────────────────
function buildHistory(baseUsd, baseInr) {
  const now = Date.now();

  function genPoints(count, msStep, volatility) {
    const points = [];
    let price = baseUsd * (1 - volatility * count * 0.3);
    let priceInr = baseInr * (1 - volatility * count * 0.3);
    for (let i = count; i >= 0; i--) {
      const ts = new Date(now - i * msStep);
      const bump = (Math.random() - 0.48) * baseUsd * volatility;
      price = Math.max(price + bump, baseUsd * 0.88);
      priceInr = price * (baseInr / baseUsd);
      const label = i === 0 ? 'Now' : ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      points.push({ t: label, usd: +price.toFixed(2), inr: +priceInr.toFixed(2) });
    }
    // Ensure last point is exact live price
    points[points.length - 1] = { t: 'Now', usd: +baseUsd.toFixed(2), inr: +baseInr.toFixed(2) };
    return points;
  }

  return {
    '7D':  genPoints(7,  24 * 3600_000, 0.003),
    '30D': genPoints(30, 24 * 3600_000, 0.002),
    '1Y':  genPoints(12, 30 * 24 * 3600_000, 0.0015),
  };
}

// ── GET /api/gold/price ─────────────────────────────────────────────────────
router.get('/price', async (req, res) => {
  try {
    const price = await fetchLiveGoldPrice();
    res.json({ success: true, data: price });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/gold/history ───────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const price = await fetchLiveGoldPrice();
    const history = buildHistory(price.usdPerOz, price.inrPerOz);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/gold/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const price = await fetchLiveGoldPrice();

    // PGOLD token stats (on-chain would go here; realistic demo values)
    const totalSupplyGrams = 5050;
    const marketCapUSD = totalSupplyGrams * price.usdPerGram;
    const marketCapINR = totalSupplyGrams * price.inrPerGram;

    res.json({
      success: true,
      data: {
        goldPrice: price,
        token: {
          name: 'PGOLD',
          symbol: 'PGOLD',
          decimals: 18,
          totalSupplyGrams,
          totalSupplyFormatted: totalSupplyGrams.toLocaleString(),
          marketCapUSD: +marketCapUSD.toFixed(2),
          marketCapINR: +marketCapINR.toFixed(2),
          marketCapFormatted: `$${(marketCapUSD / 1e6).toFixed(2)}M`,
          activeHolders: 127,
          totalBatches: 5,
          vaultReserveGrams: totalSupplyGrams,
          volumeUSD24h: 1768000,
          trades24h: 342,
          pgoldUsdPrice: +price.usdPerGram.toFixed(4),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
