const mongoose = require('mongoose');

const goldBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  weight: { type: Number, required: true }, // in grams
  purity: { type: Number, required: true }, // e.g., 24, 22
  location: { type: String, required: true },
  certification: { type: String },
  isPublic: { type: Boolean, default: true },
  adminEmail: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GoldBatch', goldBatchSchema);
