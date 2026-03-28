const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { sleep } = require('../utils/helpers');

const goldTokenAbi = require('../abi/GoldToken.json');
const batchManagerAbi = require('../abi/GoldBatchManager.json');

const RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 2000;

let provider = null;
let goldToken = null;
let batchManager = null;
let initializedAt = null;

const validateEnv = () => {
  const missing = [];
  if (!process.env.MONAD_RPC_URL) missing.push('MONAD_RPC_URL');
  if (!process.env.GOLD_TOKEN_ADDRESS) missing.push('GOLD_TOKEN_ADDRESS');
  if (!process.env.BATCH_MANAGER_ADDRESS) missing.push('BATCH_MANAGER_ADDRESS');
  if (missing.length > 0) {
    throw new Error(`Missing blockchain configuration: ${missing.join(', ')}`);
  }
};

const normalizeAddress = (value, name) => {
  try {
    return ethers.utils.getAddress(String(value));
  } catch {
    throw new Error(`Invalid ${name}: ${value}`);
  }
};

const verifyContract = async (rpcProvider, address, label) => {
  const code = await rpcProvider.getCode(address);
  if (!code || code === '0x') {
    throw new Error(`${label} contract not found at ${address}`);
  }
};

const initBlockchain = async () => {
  validateEnv();

  const rpcUrl = process.env.MONAD_RPC_URL;
  const goldAddress = normalizeAddress(process.env.GOLD_TOKEN_ADDRESS, 'GOLD_TOKEN_ADDRESS');
  const batchAddress = normalizeAddress(process.env.BATCH_MANAGER_ADDRESS, 'BATCH_MANAGER_ADDRESS');

  logger.info('Initializing blockchain services');
  const rpcProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const latestBlock = await rpcProvider.getBlockNumber();

  const token = new ethers.Contract(goldAddress, goldTokenAbi, rpcProvider);
  const manager = new ethers.Contract(batchAddress, batchManagerAbi, rpcProvider);

  await Promise.all([
    verifyContract(rpcProvider, goldAddress, 'GoldToken'),
    verifyContract(rpcProvider, batchAddress, 'GoldBatchManager'),
  ]);

  provider = rpcProvider;
  goldToken = token;
  batchManager = manager;
  initializedAt = new Date().toISOString();

  logger.info('Blockchain initialized at block %d', latestBlock);
  return getBlockchain();
};

const reconnect = async () => {
  let attempt = 0;
  let lastError = null;

  while (attempt < RECONNECT_ATTEMPTS) {
    attempt += 1;
    try {
      logger.warn('Reconnecting blockchain (attempt %d/%d)', attempt, RECONNECT_ATTEMPTS);
      await initBlockchain();
      return getBlockchain();
    } catch (error) {
      lastError = error;
      const delay = RECONNECT_BASE_DELAY_MS * attempt;
      logger.warn('Reconnect attempt %d failed: %s', attempt, error.message);
      await sleep(delay);
    }
  }

  throw new Error(`Blockchain reconnect failed after ${RECONNECT_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}`);
};

const isBlockchainReady = () => Boolean(provider && goldToken && batchManager);

const getBlockchain = () => {
  if (!isBlockchainReady()) {
    throw new Error('Blockchain services not initialized');
  }

  return {
    provider,
    goldToken,
    batchManager,
    initializedAt,
  };
};

module.exports = {
  getBlockchain,
  initBlockchain,
  isBlockchainReady,
  reconnect,
};
