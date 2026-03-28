const express = require('express');
const db = require('../db');
const logger = require('../utils/logger');
const { clamp, parsePositiveInt, toGrams } = require('../utils/helpers');
const { getCurrentGoldPrice } = require('../services/price');
const { getBlockchain, isBlockchainReady } = require('../services/blockchain');
const { requireAdminAuth } = require('../middlewares/adminAuth');

const router = express.Router();

const sendError = (res, status, message) => {
  res.status(status).json({ success: false, message });
};

const ensureBlockchainReady = (res) => {
  if (!isBlockchainReady()) {
    sendError(res, 503, 'Blockchain is not ready. Check server logs and MONAD configuration.');
    return false;
  }
  return true;
};

router.get('/stats', async (req, res) => {
  try {
    if (!ensureBlockchainReady(res)) return;

    const { goldToken, network } = getBlockchain();
    const totalSupplyWei = await goldToken.totalSupply();
    const totalSupplyGrams = toGrams(totalSupplyWei);
    const price = getCurrentGoldPrice();

    const holderCountResult = await db.query('SELECT COUNT(*)::int AS count FROM holders WHERE balance > 0');
    const holders = Number(holderCountResult.rows?.[0]?.count || 0);

    res.json({
      success: true,
      data: {
        totalSupply: totalSupplyGrams,
        marketCapUSD: totalSupplyGrams * Number(price.usd || 0),
        marketCapINR: totalSupplyGrams * Number(price.inr || 0),
        holders,
        goldPrice: price,
        network: {
          name: network?.name || null,
          chainId: network?.chainId || null,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('GET /stats failed: %s', error.message);
    sendError(res, 500, 'Failed to fetch stats');
  }
});

router.get('/batches', async (req, res) => {
  try {
    const page = Math.max(1, parsePositiveInt(req.query.page, 1));
    const limit = clamp(parsePositiveInt(req.query.limit, 20), 1, 100);
    const offset = (page - 1) * limit;
    const price = getCurrentGoldPrice();

    const result = await db.query(
      `SELECT
         id,
         weight,
         purity,
         location,
         certification,
         is_public,
         added_at,
         added_by,
         (weight * $1::numeric) AS value_usd,
         (weight * $2::numeric) AS value_inr
       FROM batches
       ORDER BY id DESC
       LIMIT $3 OFFSET $4`,
      [price.usd, price.inr, limit, offset]
    );

    const totalResult = await db.query('SELECT COUNT(*)::int AS count FROM batches');
    const total = Number(totalResult.rows?.[0]?.count || 0);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    logger.error('GET /batches failed: %s', error.message);
    sendError(res, 500, 'Failed to fetch batches');
  }
});

router.get('/holders', async (req, res) => {
  try {
    const page = Math.max(1, parsePositiveInt(req.query.page, 1));
    const limit = clamp(parsePositiveInt(req.query.limit, 50), 1, 100);
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT address, balance, last_updated
       FROM holders
       WHERE balance > 0
       ORDER BY balance DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const totalResult = await db.query('SELECT COUNT(*)::int AS count FROM holders WHERE balance > 0');
    const total = Number(totalResult.rows?.[0]?.count || 0);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    logger.error('GET /holders failed: %s', error.message);
    sendError(res, 500, 'Failed to fetch holders');
  }
});

router.get('/transactions', requireAdminAuth, async (req, res) => {
  try {
    const limit = clamp(parsePositiveInt(req.query.limit, 20), 1, 100);
    const result = await db.query(
      `SELECT tx_hash, log_index, event_type, from_address, to_address, amount, block_number, timestamp, contract_address
       FROM transactions
       ORDER BY block_number DESC, log_index DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('GET /transactions failed: %s', error.message);
    sendError(res, 500, 'Failed to fetch transactions');
  }
});

router.get('/price', async (req, res) => {
  try {
    res.json({ success: true, data: getCurrentGoldPrice() });
  } catch (error) {
    logger.error('GET /price failed: %s', error.message);
    sendError(res, 500, 'Failed to fetch price');
  }
});

module.exports = router;
