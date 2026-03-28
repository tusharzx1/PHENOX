const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');

// Simple mock auth - bypassed if no CLERK_SECRET_KEY
const mockAuth = (req, res, next) => {
  req.auth = { claims: { email: req.headers['x-admin-email'] || 'demo@phenox.com' } };
  next();
};

// Protected route to add a batch
router.post('/', mockAuth, batchController.addBatch);

// Public route to get batches
router.get('/', batchController.getBatches);

module.exports = router;
