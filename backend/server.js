const express = require('express');
const cors = require('cors');
require('dotenv').config();

const goldRoutes = require('./routes/goldRoutes');

const app = express();

// ── CORS: allow public-panel (3002), frontend (3000), and any origin in dev
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Gold routes
app.use('/api/gold', goldRoutes);

// ── Legacy price endpoint (keep for backwards compat)
app.get('/api/gold-price', async (req, res) => {
  try {
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
    const response = await fetch('https://GoldPrice.Today/api.php?data=live', { timeout: 5000 });
    const data = await response.json();
    const usdPerGram = parseFloat(data?.USD?.gold_price || 3200) / 31.1035;
    res.json({ usd: +usdPerGram.toFixed(4), inr: +(usdPerGram * 83.7).toFixed(2), timestamp: Date.now() });
  } catch {
    res.json({ usd: 102.83, inr: 8604.27, timestamp: Date.now() });
  }
});

// ── POST /api/log - admin action log
app.post('/api/log', (req, res) => {
  const { action, details } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] | ${action} | ${details} | IP: ${ip}`);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
