const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { requireAdminAuth } = require('../middlewares/adminAuth');

// Protected route to add a batch
router.post('/', requireAdminAuth, batchController.addBatch);

// Public route to get batches
router.get('/', batchController.getBatches);

module.exports = router;
