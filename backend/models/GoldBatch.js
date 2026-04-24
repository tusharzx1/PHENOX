const mongoose = require('mongoose');

const goldBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  weight: { type: Number, required: true }, // in grams
  purity: { type: Number, required: true }, // e.g., 24, 22
  location: { type: String, required: true },
  certification: { type: String },
  certificateVerification: {
    isValid: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    extractedData: {
      serialNumber: { type: String, default: null },
      grossWeight: { type: Number, default: null },
      purity: { type: String, default: null },
      assayer: { type: String, default: null },
      dateOfIssue: { type: String, default: null },
    },
    model: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
  },
  isPublic: { type: Boolean, default: true },
  adminEmail: { type: String, required: true },
  onChain: {
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'FAILED', 'SKIPPED'],
      default: 'PENDING'
    },
    chain: { type: String, default: 'monad-testnet' },
    chainId: { type: Number },
    txHash: { type: String },
    blockNumber: { type: Number },
    gasLimit: { type: String },
    gasUsed: { type: String },
    effectiveGasPriceWei: { type: String },
    gasChargedByLimit: { type: Boolean, default: true },
    payloadHash: { type: String },
    explorerUrl: { type: String },
    metadataURI: { type: String },
    error: { type: String },
    anchoredAt: { type: Date }
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GoldBatch', goldBatchSchema);
