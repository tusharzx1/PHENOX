const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const usdPerGram = 64.25;
  const inrPerUSD = 83.15;
  res.json({
    success: true,
    data: {
      usd: usdPerGram,
      inr: usdPerGram * inrPerUSD,
      timestamp: Date.now()
    }
  });
});

module.exports = router;
