const express = require('express');
const multer = require('multer');
const { requireAdminAuth } = require('../middlewares/adminAuth');
const { verifyCertificateFile } = require('../services/certificateVerification');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.post('/verify-certificate', requireAdminAuth, (req, res, next) => {
  upload.single('certificate')(req, res, async (error) => {
    if (error) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        success: false,
        message: error.code === 'LIMIT_FILE_SIZE'
          ? 'Certificate file exceeds the 20 MB upload limit.'
          : error.message || 'Failed to process certificate upload.',
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No certificate file uploaded.',
        });
      }

      const analysis = await verifyCertificateFile(req.file);
      return res.json({
        success: true,
        ...analysis,
      });
    } catch (err) {
      return next(err);
    }
  });
});

module.exports = router;
