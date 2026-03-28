const express = require('express');
const crypto = require('crypto');
const { ethers } = require('ethers');
const GoldBatch = require('../models/GoldBatch');
const AdminLog = require('../models/AdminLog');
const { requireAdminAuth } = require('../middlewares/adminAuth');

const router = express.Router();
const inMemoryBatches = [];
const isDbConnected = () => GoldBatch?.db?.readyState === 1;
const MONAD_DOCS_GAS_PRICING_URL = 'https://docs.monad.xyz/developer-essentials/gas-pricing';
const MONAD_DOCS_TESTNETS_URL = 'https://docs.monad.xyz/developer-essentials/testnets';
const MONAD_TESTNET_CHAIN_ID = 10143;
const MONAD_DEFAULT_EXPLORER_TX_BASE = 'https://testnet.monadvision.com/tx/';

const DEFAULT_ANCHOR_ABI = [
  'function registerBatch(string batchId, bytes32 payloadHash, string metadataURI) external returns (bool)'
];

const parseBool = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return defaultValue;
};

const toCanonicalPayload = (batch) => ({
  batchId: String(batch.batchId || ''),
  weight: Number(batch.weight || 0),
  purity: Number(batch.purity || 0),
  location: String(batch.location || ''),
  certification: String(batch.certification || ''),
  isPublic: Boolean(batch.isPublic),
  timestamp: batch.timestamp ? new Date(batch.timestamp).toISOString() : new Date().toISOString()
});

const hashPayload = (payload) => {
  const canonical = JSON.stringify(payload);
  return `0x${crypto.createHash('sha256').update(canonical).digest('hex')}`;
};

const getFirstDefinedEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const toPositiveIntOrNull = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toPositiveNumberOrNull = (value) => {
  const parsed = Number(String(value || ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getMonadAnchorConfig = () => {
  const chainName = getFirstDefinedEnv(
    'MONAD_ANCHOR_CHAIN_NAME',
    'MONAD_NETWORK',
    'L1_CHAIN_NAME'
  ) || 'monad-testnet';

  return {
    rpcUrl: getFirstDefinedEnv('MONAD_ANCHOR_RPC_URL', 'L1_RPC_URL'),
    privateKey: getFirstDefinedEnv('MONAD_ANCHOR_PRIVATE_KEY', 'L1_PRIVATE_KEY'),
    contractAddress: getFirstDefinedEnv('MONAD_ANCHOR_REGISTRY_CONTRACT', 'L1_REGISTRY_CONTRACT'),
    methodName: getFirstDefinedEnv('MONAD_ANCHOR_REGISTRY_METHOD', 'L1_REGISTRY_METHOD') || 'registerBatch',
    confirmations: toPositiveIntOrNull(getFirstDefinedEnv('MONAD_ANCHOR_CONFIRMATIONS', 'L1_CONFIRMATIONS')) || 1,
    strictMode: parseBool(getFirstDefinedEnv('MONAD_ANCHOR_STRICT_MODE', 'L1_STRICT_MODE'), false),
    chainName,
    expectedChainId: toPositiveIntOrNull(
      getFirstDefinedEnv('MONAD_ANCHOR_CHAIN_ID', 'MONAD_EXPECTED_CHAIN_ID')
    ) || MONAD_TESTNET_CHAIN_ID,
    explorerTxBaseUrl: getFirstDefinedEnv(
      'MONAD_ANCHOR_EXPLORER_TX_BASE',
      'MONAD_TESTNET_EXPLORER_TX_BASE'
    ) || MONAD_DEFAULT_EXPLORER_TX_BASE,
    gasLimit: toPositiveIntOrNull(getFirstDefinedEnv('MONAD_ANCHOR_GAS_LIMIT', 'L1_GAS_LIMIT')),
    maxFeePerGasGwei: toPositiveNumberOrNull(
      getFirstDefinedEnv('MONAD_ANCHOR_MAX_FEE_PER_GAS_GWEI', 'L1_MAX_FEE_PER_GAS_GWEI')
    ),
    maxPriorityFeePerGasGwei: toPositiveNumberOrNull(
      getFirstDefinedEnv('MONAD_ANCHOR_MAX_PRIORITY_FEE_PER_GAS_GWEI', 'L1_MAX_PRIORITY_FEE_PER_GAS_GWEI')
    )
  };
};

const getExplorerUrl = (chainName, txHash, explorerTxBaseUrl = '') => {
  if (!txHash) return '';
  if (chainName.toLowerCase().includes('sepolia')) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (chainName.toLowerCase().includes('ethereum')) return `https://etherscan.io/tx/${txHash}`;
  if (chainName.toLowerCase().includes('monad')) {
    const base = String(explorerTxBaseUrl || MONAD_DEFAULT_EXPLORER_TX_BASE).replace(/\/+$/, '');
    return `${base}/${txHash}`;
  }
  return '';
};

const anchorBatchToL1 = async ({ batchId, metadataURI, payloadHash }) => {
  const config = getMonadAnchorConfig();
  const missingConfig = [];

  if (!config.rpcUrl) missingConfig.push('MONAD_ANCHOR_RPC_URL');
  if (!config.privateKey) missingConfig.push('MONAD_ANCHOR_PRIVATE_KEY');
  if (!config.contractAddress) missingConfig.push('MONAD_ANCHOR_REGISTRY_CONTRACT');

  if (missingConfig.length > 0) {
    const error = `Missing blockchain config: ${missingConfig.join(', ')}`;
    if (config.strictMode) throw new Error(error);
    return {
      status: 'SKIPPED',
      chain: config.chainName,
      error
    };
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const network = await provider.getNetwork();
    if (config.expectedChainId && Number(network.chainId) !== Number(config.expectedChainId)) {
      throw new Error(
        `RPC chainId mismatch (expected ${config.expectedChainId}, got ${Number(network.chainId)}). Check ${MONAD_DOCS_TESTNETS_URL}`
      );
    }
    const signer = new ethers.Wallet(config.privateKey, provider);
    const contract = new ethers.Contract(config.contractAddress, DEFAULT_ANCHOR_ABI, signer);

    if (typeof contract[config.methodName] !== 'function') {
      throw new Error(`Contract method "${config.methodName}" not found`);
    }

    const txOptions = {};
    if (config.gasLimit) txOptions.gasLimit = config.gasLimit;
    if (config.maxFeePerGasGwei) {
      txOptions.maxFeePerGas = ethers.utils.parseUnits(String(config.maxFeePerGasGwei), 'gwei');
    }
    if (config.maxPriorityFeePerGasGwei) {
      txOptions.maxPriorityFeePerGas = ethers.utils.parseUnits(
        String(config.maxPriorityFeePerGasGwei),
        'gwei'
      );
    }

    const tx = await contract[config.methodName](
      batchId,
      payloadHash,
      metadataURI || '',
      txOptions
    );
    const receipt = await tx.wait(config.confirmations);

    return {
      status: receipt.status === 1 ? 'CONFIRMED' : 'FAILED',
      chain: config.chainName,
      chainId: Number(network.chainId),
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasLimit: tx.gasLimit ? tx.gasLimit.toString() : null,
      gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : null,
      effectiveGasPriceWei: receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : null,
      gasChargedByLimit: true,
      payloadHash,
      explorerUrl: getExplorerUrl(config.chainName, tx.hash, config.explorerTxBaseUrl),
      anchoredAt: new Date().toISOString(),
      error: receipt.status === 1 ? '' : 'Transaction failed on-chain'
    };
  } catch (err) {
    if (config.strictMode) throw err;
    return {
      status: 'FAILED',
      chain: config.chainName,
      payloadHash,
      error: err.message || 'Unknown blockchain anchoring error'
    };
  }
};

const toPublicRecord = (batch) => ({
  batchId: batch.batchId,
  weight: batch.weight,
  purity: batch.purity,
  location: batch.location,
  certification: batch.certification,
  timestamp: batch.timestamp,
  onChain: batch.onChain || { status: 'SKIPPED' }
});

const toAdminRecord = (batch) => ({
  batchId: batch.batchId,
  weight: batch.weight,
  purity: batch.purity,
  location: batch.location,
  certification: batch.certification,
  isPublic: Boolean(batch.isPublic),
  adminEmail: batch.adminEmail,
  timestamp: batch.timestamp,
  onChain: batch.onChain || { status: 'SKIPPED' }
});

router.get('/health', (req, res) => {
  const cfg = getMonadAnchorConfig();
  res.json({
    success: true,
    chain: cfg.chainName,
    blockchainConfigured: Boolean(cfg.rpcUrl && cfg.privateKey && cfg.contractAddress),
    strictMode: cfg.strictMode,
    expectedChainId: cfg.expectedChainId,
    explorerTxBaseUrl: cfg.explorerTxBaseUrl,
    docs: {
      gasPricing: MONAD_DOCS_GAS_PRICING_URL,
      testnets: MONAD_DOCS_TESTNETS_URL
    }
  });
});

// Admin pushes batch data -> backend stores -> anchors hash on Monad.
router.post('/admin/push', requireAdminAuth, async (req, res) => {
  try {
    const {
      batchId,
      weight,
      purity,
      location,
      certification,
      isPublic = true,
      metadataURI = ''
    } = req.body;

    if (!batchId || !weight || !purity || !location) {
      return res.status(400).json({
        success: false,
        message: 'batchId, weight, purity and location are required'
      });
    }

    const adminEmail = req.auth?.claims?.email || req.userId || 'unknown-admin';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const batchCore = {
      batchId: String(batchId).trim(),
      weight: Number(weight),
      purity: Number(purity),
      location: String(location).trim(),
      certification: certification ? String(certification) : '',
      isPublic: parseBool(isPublic, true),
      adminEmail,
      timestamp: new Date()
    };

    const payloadHash = hashPayload(toCanonicalPayload(batchCore));
    const onChain = await anchorBatchToL1({
      batchId: batchCore.batchId,
      metadataURI,
      payloadHash
    });

    const batchToStore = {
      ...batchCore,
      onChain: {
        ...onChain,
        payloadHash,
        metadataURI
      }
    };

    let savedBatch;
    try {
      if (!isDbConnected()) throw new Error('MongoDB not connected');
      savedBatch = await GoldBatch.create(batchToStore);
    } catch {
      inMemoryBatches.unshift(batchToStore);
      savedBatch = batchToStore;
    }

    try {
      if (!isDbConnected()) throw new Error('MongoDB not connected');
      await AdminLog.create({
        adminEmail,
        action: 'ADD_BATCH_ONCHAIN',
        details: `Batch ${batchCore.batchId} pushed. ChainStatus=${onChain.status} Tx=${onChain.txHash || 'n/a'}`,
        ipAddress
      });
    } catch {
      // keep endpoint resilient even when DB logs are unavailable
    }

    return res.status(201).json({
      success: true,
      data: savedBatch,
      note: onChain.status === 'CONFIRMED'
        ? 'Batch anchored on Monad and now available to public panel.'
        : 'Batch saved but blockchain anchor is pending/failed/skipped.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to push batch to blockchain backend'
    });
  }
});

// Admin dashboard can see all records, including private entries.
router.get('/admin/records', requireAdminAuth, async (req, res) => {
  try {
    try {
      if (!isDbConnected()) throw new Error('MongoDB not connected');
      const records = await GoldBatch.find({}).sort({ timestamp: -1 }).lean();
      return res.json({
        success: true,
        source: 'database',
        data: records.map(toAdminRecord)
      });
    } catch {
      return res.json({
        success: true,
        source: 'memory-fallback',
        data: [...inMemoryBatches].map(toAdminRecord)
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load admin blockchain records'
    });
  }
});

// Public panel consumes only public batches.
router.get('/public/records', async (req, res) => {
  try {
    try {
      if (!isDbConnected()) throw new Error('MongoDB not connected');
      const records = await GoldBatch.find({ isPublic: true }).sort({ timestamp: -1 }).lean();
      return res.json({
        success: true,
        source: 'database',
        data: records.map(toPublicRecord)
      });
    } catch {
      const records = inMemoryBatches.filter((batch) => batch.isPublic);
      return res.json({
        success: true,
        source: 'memory-fallback',
        data: records.map(toPublicRecord)
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load public blockchain records'
    });
  }
});

module.exports = router;
