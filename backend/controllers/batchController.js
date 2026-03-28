const GoldBatch = require('../models/GoldBatch');
const AdminLog = require('../models/AdminLog');

exports.addBatch = async (req, res) => {
  try {
    const { batchId, weight, purity, location, certification, isPublic } = req.body;
    
    // Clerk session info available in req.auth (RequireAuth middleware)
    const adminEmail = req.auth?.claims?.email || 'unknown@phenox.com';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const newBatch = new GoldBatch({
      batchId,
      weight,
      purity,
      location,
      certification,
      isPublic,
      adminEmail
    });

    await newBatch.save();

    // Log the action
    const log = new AdminLog({
      adminEmail,
      action: 'ADD_BATCH',
      details: `Batch ID: ${batchId}, Weight: ${weight}g`,
      ipAddress
    });
    await log.save();

    res.status(201).json({ success: true, data: newBatch });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const batches = await GoldBatch.find({}).sort({ timestamp: -1 });
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
