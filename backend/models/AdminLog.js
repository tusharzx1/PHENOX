const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  adminEmail: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String },
  ipAddress: { type: String }
});

adminLogSchema.index({ timestamp: -1 });
adminLogSchema.index({ adminEmail: 1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
