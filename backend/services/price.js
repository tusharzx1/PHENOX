const axios = require('axios');
const cron = require('node-cron');
const db = require('../db');
const logger = require('../utils/logger');
const { toNumber } = require('../utils/helpers');

const OUNCE_TO_GRAM = 31.1034768;
const HTTP_TIMEOUT_MS = Number(process.env.DASHBOARD_HTTP_TIMEOUT_MS || 12000);

let cronTask = null;
let cachedPrice = {
  usd: 64.0,
  inr: 5312.0,
  source: 'Static fallback',
  usdPerOunce: 64.0 * OUNCE_TO_GRAM,
  usdInr: 83.0,
  quoteTimestamp: null,
  lastUpdated: null,
  isFallback: true,
};

const fetchText = async (url) => {
  const response = await axios.get(url, {
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      Accept: '*/*',
      'User-Agent': 'PHENOX-Price-Service/1.0',
    },
    responseType: 'text',
  });
  return String(response.data || '');
};

const parseCsvQuote = (csvText) => {
  const lines = String(csvText || '').trim().split('\n');
  if (lines.length < 2) throw new Error('CSV quote is missing data row');
  const row = lines[1].split(',').map((value) => value.trim());
  return {
    symbol: row[0],
    date: row[1],
    time: row[2],
    open: toNumber(row[3], 0),
    high: toNumber(row[4], 0),
    low: toNumber(row[5], 0),
    close: toNumber(row[6], 0),
  };
};

const persistPrice = async (price) => {
  try {
    await db.query(
      `INSERT INTO price_cache (currency, price_per_gram, source, fetched_at)
       VALUES ($1, $2, $3, NOW()), ($4, $5, $6, NOW())`,
      ['USD', price.usd, price.source, 'INR', price.inr, price.source]
    );
  } catch (error) {
    logger.warn('Price cache persistence skipped: %s', error.message);
  }
};

const fetchGoldMeterPrice = async () => {
  try {
    const html = await fetchText('https://goldmeter.in/');
    // Extract price from HTML using regex (matches ₹ 6,XXX per gram for 24K)
    const perGram24kMatch = html.match(/₹\s*([\d,]+)\s*per gram for 24K/i);
    if (perGram24kMatch) {
      const price = Number(perGram24kMatch[1].replace(/,/g, ''));
      if (price > 1000) return price;
    }
    return null;
  } catch (err) {
    logger.warn('GoldMeter fetch failed: %s', err.message);
    return null;
  }
};

const fetchGoldPrice = async () => {
  try {
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
    const globalInrPerGram = usdPerGram * usdInr;

    // Try to get retail price from GoldMeter as a high-fidelity 24K source
    const retailInr = await fetchGoldMeterPrice();
    const finalInr = retailInr || globalInrPerGram;

    const nextPrice = {
      usd: usdPerGram,
      inr: finalInr,
      usdPerOunce,
      usdInr,
      source: retailInr ? 'GoldMeter 24K Retail (Verified)' : 'Stooq Spot Price (Calculated)',
      quoteTimestamp: `${xauQuote.date} ${xauQuote.time} UTC`,
      lastUpdated: new Date().toISOString(),
      isFallback: false,
    };

    cachedPrice = nextPrice;
    await persistPrice(nextPrice);
    logger.info('Gold price updated (USD/g=%.4f INR/g=%.4f)', nextPrice.usd, nextPrice.inr);
    return cachedPrice;
  } catch (error) {
    logger.warn('Gold price fetch failed, using cached value: %s', error.message);
    return cachedPrice;
  }
};

const startPriceScheduler = () => {
  if (cronTask) return;

  cronTask = cron.schedule('*/5 * * * *', () => {
    fetchGoldPrice().catch((error) => {
      logger.error('Price refresh crashed: %s', error.message);
    });
  });

  fetchGoldPrice().catch((error) => {
    logger.error('Initial price fetch failed: %s', error.message);
  });
};

const stopPriceScheduler = () => {
  if (!cronTask) return;
  cronTask.stop();
  cronTask.destroy();
  cronTask = null;
};

const getCurrentGoldPrice = () => ({ ...cachedPrice });

module.exports = {
  fetchGoldPrice,
  getCurrentGoldPrice,
  startPriceScheduler,
  stopPriceScheduler,
};
