const express = require('express');
const crypto = require('crypto');
const { ethers } = require('ethers');
const GoldBatch = require('../models/GoldBatch');
const AdminLog = require('../models/AdminLog');

const router = express.Router();
const inMemoryBatches = [];
const isDbConnected = () => GoldBatch?.db?.readyState === 1;

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

const getL1Config = () => ({
  rpcUrl: process.env.L1_RPC_URL || '',
  privateKey: process.env.L1_PRIVATE_KEY || '',
  contractAddress: process.env.L1_REGISTRY_CONTRACT || '',
  methodName: process.env.L1_REGISTRY_METHOD || 'registerBatch',
  confirmations: Number(process.env.L1_CONFIRMATIONS || 1),
  strictMode: parseBool(process.env.L1_STRICT_MODE, false),
  chainName: process.env.L1_CHAIN_NAME || 'ethereum'
});

const getExplorerUrl = (chainName, txHash) => {
  if (!txHash) return '';
  if (chainName.toLowerCase().includes('sepolia')) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (chainName.toLowerCase().includes('ethereum')) return `https://etherscan.io/tx/${txHash}`;
  if (chainName.toLowerCase().includes('monad')) return '';
  return '';
};

const anchorBatchToL1 = async ({ batchId, metadataURI, payloadHash }) => {
  const config = getL1Config();
  const missingConfig = [];

  if (!config.rpcUrl) missingConfig.push('L1_RPC_URL');
  if (!config.privateKey) missingConfig.push('L1_PRIVATE_KEY');
  if (!config.contractAddress) missingConfig.push('L1_REGISTRY_CONTRACT');

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
    const signer = new ethers.Wallet(config.privateKey, provider);
    const contract = new ethers.Contract(config.contractAddress, DEFAULT_ANCHOR_ABI, signer);

    if (typeof contract[config.methodName] !== 'function') {
      throw new Error(`Contract method "${config.methodName}" not found`);
    }

    const tx = await contract[config.methodName](batchId, payloadHash, metadataURI || '');
    const receipt = await tx.wait(config.confirmations);

    return {
      status: receipt.status === 1 ? 'CONFIRMED' : 'FAILED',
      chain: config.chainName,
      chainId: Number(network.chainId),
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      payloadHash,
      explorerUrl: getExplorerUrl(config.chainName, tx.hash),
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
  const cfg = getL1Config();
  res.json({
    success: true,
    chain: cfg.chainName,
    blockchainConfigured: Boolean(cfg.rpcUrl && cfg.privateKey && cfg.contractAddress),
    strictMode: cfg.strictMode
  });
});

// Admin pushes batch data -> backend stores -> anchors hash on L1.
router.post('/admin/push', async (req, res) => {
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

    const adminEmail = req.auth?.claims?.email || req.headers['x-admin-email'] || 'demo@phenox.com';
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
        ? 'Batch anchored on L1 and now available to public panel.'
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
router.get('/admin/records', async (req, res) => {
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
