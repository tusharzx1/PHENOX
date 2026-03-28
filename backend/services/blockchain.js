const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { sleep } = require('../utils/helpers');

const goldTokenAbi = require('../abi/GoldToken.json');
const batchManagerAbi = require('../abi/GoldBatchManager.json');

const RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 2000;
const MONAD_DOCS_TESTNET_URL = 'https://docs.monad.xyz/developer-essentials/testnets';
const MONAD_DOCS_RPC_PROVIDERS_URL = 'https://docs.monad.xyz/tooling-and-infra/rpc-providers';

let provider = null;
let goldToken = null;
let batchManager = null;
let initializedAt = null;
let network = null;

const validateEnv = () => {
  const missing = [];
  if (!process.env.MONAD_RPC_URL) missing.push('MONAD_RPC_URL');
  if (!process.env.GOLD_TOKEN_ADDRESS) missing.push('GOLD_TOKEN_ADDRESS');
  if (!process.env.BATCH_MANAGER_ADDRESS) missing.push('BATCH_MANAGER_ADDRESS');
  if (missing.length > 0) {
    throw new Error(`Missing blockchain configuration: ${missing.join(', ')}`);
  }
};

const toOptionalPositiveInt = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeAddress = (value, name) => {
  try {
    return ethers.utils.getAddress(String(value));
  } catch {
    throw new Error(`Invalid ${name}: ${value}`);
  }
};

const isWebsocketUrl = (url) => /^wss?:\/\//i.test(String(url || ''));

const createProvider = (rpcUrl) => (
  isWebsocketUrl(rpcUrl)
    ? new ethers.providers.WebSocketProvider(rpcUrl)
    : new ethers.providers.JsonRpcProvider(rpcUrl)
);

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
  const expectedChainId = toOptionalPositiveInt(process.env.MONAD_EXPECTED_CHAIN_ID);
  const configuredNetworkName = String(process.env.MONAD_NETWORK || '').trim();

  logger.info('Initializing blockchain services for Monad');
  const rpcProvider = createProvider(rpcUrl);
  const chainInfo = await rpcProvider.getNetwork();
  const chainId = Number(chainInfo?.chainId || 0);
  if (!chainId) {
    throw new Error('Failed to determine chain ID from MONAD_RPC_URL');
  }
  if (expectedChainId && chainId !== expectedChainId) {
    throw new Error(
      `RPC chainId mismatch (expected ${expectedChainId}, got ${chainId}). Check ${MONAD_DOCS_TESTNET_URL}`
    );
  }
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
  network = {
    chainId,
    name: configuredNetworkName || chainInfo?.name || 'monad',
    rpcUrl,
  };

  logger.info(
    'Blockchain initialized at block %d (network=%s chainId=%d provider=%s)',
    latestBlock,
    network.name,
    network.chainId,
    isWebsocketUrl(rpcUrl) ? 'websocket' : 'http'
  );
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

  throw new Error(
    `Blockchain reconnect failed after ${RECONNECT_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}. See ${MONAD_DOCS_RPC_PROVIDERS_URL}`
  );
};

const isBlockchainReady = () => Boolean(provider && goldToken && batchManager);

const closeBlockchain = async () => {
  if (!provider) return;
  try {
    if (provider?.removeAllListeners) provider.removeAllListeners();
    if (provider?._websocket?.terminate) provider._websocket.terminate();
    if (provider?._websocket?.close) provider._websocket.close();
  } catch (error) {
    logger.warn('Error while closing blockchain provider: %s', error.message);
  } finally {
    provider = null;
    goldToken = null;
    batchManager = null;
    network = null;
    initializedAt = null;
  }
};

const getBlockchain = () => {
  if (!isBlockchainReady()) {
    throw new Error('Blockchain services not initialized');
  }

  return {
    provider,
    goldToken,
    batchManager,
    initializedAt,
    network,
  };
};

module.exports = {
  closeBlockchain,
  getBlockchain,
  initBlockchain,
  isBlockchainReady,
  reconnect,
};
