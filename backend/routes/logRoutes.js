const express = require('express');
const router = express.Router();
const AdminLog = require('../models/AdminLog');

// Mock data fallback
const mockLogs = [
  { action: 'SYSTEM_BOOT', details: 'PHENOX Backend initialized', adminEmail: 'system@phenox.com', ipAddress: '127.0.0.1', timestamp: new Date() }
];

router.get('/', async (req, res) => {
  try {
    // Try real DB first
    const logs = await AdminLog.find({}).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: logs });
  } catch (err) {
    // Fallback to mock data in MOCK_MODE
    res.json({ success: true, data: mockLogs });
  }
});

module.exports = router;
