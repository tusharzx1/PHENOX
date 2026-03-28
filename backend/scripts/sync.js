require('dotenv').config();

const logger = require('../utils/logger');
const { initBlockchain } = require('../services/blockchain');
const { refreshBatches, syncHistorical } = require('../services/indexer');
const db = require('../db');

async function runSync() {
  try {
    await initBlockchain();
    await syncHistorical();
    await refreshBatches();
    logger.info('One-time sync completed');
    process.exit(0);
  } catch (error) {
    logger.error('One-time sync failed: %s', error.message);
    process.exit(1);
  } finally {
    await db.closePool().catch(() => {});
  }
}

runSync();
