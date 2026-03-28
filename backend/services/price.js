const axios = require('axios');
const cron = require('node-cron');
const db = require('../db');
const logger = require('../utils/logger');
const { toNumber } = require('../utils/helpers');

const OUNCE_TO_GRAM = 31.1034768;

let cronTask = null;
let cachedPrice = {
  usd: 64.0,
  inr: 5312.0,
  source: 'Static fallback',
  lastUpdated: null,
  isFallback: true,
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

const fetchGoldPrice = async () => {
  try {
    const response = await axios.get('https://GoldPrice.Today/api.php?data=live', {
      timeout: 7000,
      headers: { Accept: 'application/json' },
    });

    const usdPerOunce = toNumber(response?.data?.USD?.gold_price, 0);
    const inrPerOunce = toNumber(response?.data?.INR?.gold_price, 0);

    if (usdPerOunce <= 0 || inrPerOunce <= 0) {
      throw new Error('Gold price response missing USD/INR data');
    }

    const nextPrice = {
      usd: usdPerOunce / OUNCE_TO_GRAM,
      inr: inrPerOunce / OUNCE_TO_GRAM,
      source: 'GoldPrice.Today',
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
