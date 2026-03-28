const db = require('../db');
const logger = require('../utils/logger');
const {
  ZERO_ADDRESS,
  clamp,
  normalizeAddress,
  parsePositiveInt,
  toBigIntNumber,
  toGrams,
} = require('../utils/helpers');
const { getBlockchain, isBlockchainReady, reconnect } = require('./blockchain');

const INDEXER_STATE_KEY = 'last_synced_block';
const CHUNK_SIZE = clamp(parsePositiveInt(process.env.INDEXER_CHUNK_SIZE, 1500), 100, 5000);
const SYNC_INTERVAL_MS = parsePositiveInt(process.env.INDEXER_SYNC_INTERVAL_MS, 60_000);
const BATCH_REFRESH_INTERVAL_MS = parsePositiveInt(process.env.BATCH_REFRESH_INTERVAL_MS, 10 * 60_000);
const START_BLOCK = Math.max(0, Number.parseInt(process.env.INDEXER_START_BLOCK || '0', 10) || 0);

let transferListener = null;
let batchListener = null;
let syncTimer = null;
let refreshTimer = null;
let running = false;
let syncing = false;

const blockTimeCache = new Map();

const hasEvent = (contract, eventName) => {
  try {
    contract.interface.getEvent(eventName);
    return true;
  } catch {
    return false;
  }
};

const toTimestamp = async (provider, blockNumber) => {
  if (!blockNumber) return new Date();
  const cached = blockTimeCache.get(blockNumber);
  if (cached) return cached;

  try {
    const block = await provider.getBlock(blockNumber);
    const date = block?.timestamp ? new Date(Number(block.timestamp) * 1000) : new Date();
    blockTimeCache.set(blockNumber, date);
    return date;
  } catch {
    return new Date();
  }
};

const ensureIndexerStateTable = async () => {
  await db.query(
    `CREATE TABLE IF NOT EXISTS indexer_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`
  );
};

const getLastSyncedBlock = async () => {
  try {
    const result = await db.query('SELECT value FROM indexer_state WHERE key = $1', [INDEXER_STATE_KEY]);
    if (!result.rows[0]) return START_BLOCK - 1;
    const parsed = Number.parseInt(result.rows[0].value, 10);
    return Number.isFinite(parsed) ? parsed : START_BLOCK - 1;
  } catch (error) {
    logger.warn('Failed to read indexer state: %s', error.message);
    return START_BLOCK - 1;
  }
};

const setLastSyncedBlock = async (blockNumber) => {
  await db.query(
    `INSERT INTO indexer_state (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [INDEXER_STATE_KEY, String(blockNumber)]
  );
};

const updateHolderBalance = async (address, goldToken) => {
  const normalized = normalizeAddress(address);
  if (!normalized || normalized === ZERO_ADDRESS) return;

  try {
    const balanceWei = await goldToken.balanceOf(normalized);
    const balanceGrams = toGrams(balanceWei);
    await db.query(
      `INSERT INTO holders (address, balance, last_updated)
       VALUES ($1, $2, NOW())
       ON CONFLICT (address) DO UPDATE SET balance = EXCLUDED.balance, last_updated = NOW()`,
      [normalized, balanceGrams]
    );
  } catch (error) {
    logger.warn('Holder balance update failed for %s: %s', normalized, error.message);
  }
};

const upsertBatchById = async (batchId, batchManager) => {
  const idNum = toBigIntNumber(batchId, -1);
  if (idNum < 0) return;

  try {
    const batch = await batchManager.getBatch(idNum);
    const timestampUnix = toBigIntNumber(batch?.timestamp ?? batch?.[6], 0);
    const addedAt = timestampUnix > 0 ? new Date(timestampUnix * 1000) : new Date();
    const addedBy = normalizeAddress(batch?.addedBy ?? batch?.[7]) || ZERO_ADDRESS;

    await db.query(
      `INSERT INTO batches (id, weight, purity, location, certification, is_public, added_at, added_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         weight = EXCLUDED.weight,
         purity = EXCLUDED.purity,
         location = EXCLUDED.location,
         certification = EXCLUDED.certification,
         is_public = EXCLUDED.is_public,
         added_at = EXCLUDED.added_at,
         added_by = EXCLUDED.added_by`,
      [
        idNum,
        String(batch?.weight ?? batch?.[1] ?? '0'),
        toBigIntNumber(batch?.purity ?? batch?.[2], 0),
        String(batch?.location ?? batch?.[3] ?? ''),
        String(batch?.certification ?? batch?.[4] ?? ''),
        Boolean(batch?.isPublic ?? batch?.[5]),
        addedAt,
        addedBy,
      ]
    );
  } catch (error) {
    logger.warn('Batch upsert failed for id=%s: %s', String(batchId), error.message);
  }
};

const processTransferEvent = async (event, chain) => {
  const from = normalizeAddress(event?.args?.from ?? event?.args?.[0]) || ZERO_ADDRESS;
  const to = normalizeAddress(event?.args?.to ?? event?.args?.[1]) || ZERO_ADDRESS;
  const value = event?.args?.value ?? event?.args?.[2] ?? 0;
  const amount = toGrams(value);
  const txHash = String(event?.transactionHash || '');
  const logIndex = Number(event?.logIndex || 0);
  const blockNumber = Number(event?.blockNumber || 0);
  const blockTime = await toTimestamp(chain.provider, blockNumber);

  if (!txHash || blockNumber <= 0) return;

  try {
    await db.query(
      `INSERT INTO transactions (tx_hash, log_index, event_type, from_address, to_address, amount, block_number, timestamp, contract_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tx_hash, log_index) DO NOTHING`,
      [txHash, logIndex, 'Transfer', from, to, amount, blockNumber, blockTime, chain.goldToken.address]
    );
  } catch (error) {
    logger.warn('Transfer transaction insert failed: %s', error.message);
  }

  await Promise.all([
    updateHolderBalance(from, chain.goldToken),
    updateHolderBalance(to, chain.goldToken),
  ]);
};

const processBatchAddedEvent = async (event, chain) => {
  const batchId = event?.args?.id ?? event?.args?.[0];
  await upsertBatchById(batchId, chain.batchManager);
};

const refreshBatches = async () => {
  if (!isBlockchainReady()) return;

  const chain = getBlockchain();
  try {
    const totalRaw = await chain.batchManager.getTotalBatches();
    const total = Math.max(0, toBigIntNumber(totalRaw, 0));

    for (let i = 0; i < total; i += 1) {
      await upsertBatchById(i, chain.batchManager);
    }

    logger.info('Batch refresh completed (%d batches)', total);
  } catch (error) {
    logger.warn('Batch refresh failed: %s', error.message);
  }
};

const syncHistorical = async () => {
  if (syncing) return;
  syncing = true;

  try {
    if (!isBlockchainReady()) {
      await reconnect();
    }

    const chain = getBlockchain();
    const latestBlock = await chain.provider.getBlockNumber();
    let fromBlock = (await getLastSyncedBlock()) + 1;

    if (fromBlock <= 0) {
      fromBlock = START_BLOCK;
    }

    if (fromBlock > latestBlock) return;

    const transferEnabled = hasEvent(chain.goldToken, 'Transfer');
    const batchEnabled = hasEvent(chain.batchManager, 'BatchAdded');

    while (fromBlock <= latestBlock) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock);

      if (transferEnabled) {
        const transferEvents = await chain.goldToken.queryFilter(
          chain.goldToken.filters.Transfer(),
          fromBlock,
          toBlock
        );
        for (const event of transferEvents) {
          await processTransferEvent(event, chain);
        }
      }

      if (batchEnabled) {
        const batchEvents = await chain.batchManager.queryFilter(
          chain.batchManager.filters.BatchAdded(),
          fromBlock,
          toBlock
        );
        for (const event of batchEvents) {
          await processBatchAddedEvent(event, chain);
        }
      }

      await setLastSyncedBlock(toBlock);
      fromBlock = toBlock + 1;
    }

    if (!transferEnabled) {
      logger.warn('Transfer event not available in GoldToken ABI; holder/transaction indexing is disabled.');
    }
    if (!batchEnabled) {
      logger.warn('BatchAdded event not available in GoldBatchManager ABI; batch event indexing is disabled.');
    }
  } catch (error) {
    logger.error('Historical sync failed: %s', error.message);
  } finally {
    syncing = false;
  }
};

const detachListeners = () => {
  if (!isBlockchainReady()) return;
  const chain = getBlockchain();
  if (transferListener) chain.goldToken.off('Transfer', transferListener);
  if (batchListener) chain.batchManager.off('BatchAdded', batchListener);
  transferListener = null;
  batchListener = null;
};

const attachListeners = () => {
  const chain = getBlockchain();

  detachListeners();

  if (hasEvent(chain.goldToken, 'Transfer')) {
    transferListener = (from, to, value, event) => {
      void processTransferEvent(event, chain);
    };
    chain.goldToken.on('Transfer', transferListener);
  }

  if (hasEvent(chain.batchManager, 'BatchAdded')) {
    batchListener = (id, weight, isPublic, addedBy, event) => {
      void processBatchAddedEvent(event, chain);
    };
    chain.batchManager.on('BatchAdded', batchListener);
  }

  logger.info('Indexer listeners attached');
};

const startIndexer = async () => {
  if (running) return;

  await ensureIndexerStateTable();

  if (!isBlockchainReady()) {
    await reconnect();
  }

  await syncHistorical();
  await refreshBatches();
  attachListeners();

  syncTimer = setInterval(() => {
    void syncHistorical();
  }, SYNC_INTERVAL_MS);

  refreshTimer = setInterval(() => {
    void refreshBatches();
  }, BATCH_REFRESH_INTERVAL_MS);

  running = true;
  logger.info('Indexer started');
};

const stopIndexer = () => {
  if (syncTimer) clearInterval(syncTimer);
  if (refreshTimer) clearInterval(refreshTimer);
  syncTimer = null;
  refreshTimer = null;
  detachListeners();
  running = false;
};

module.exports = {
  refreshBatches,
  startIndexer,
  stopIndexer,
  syncHistorical,
};
