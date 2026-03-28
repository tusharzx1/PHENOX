const express = require('express');
const cors = require('cors');
const { Clerk } = require('@clerk/backend');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

// Middleware to verify Clerk session
const requireAuth = async (req, res, next) => {
  const sessionToken = req.headers.authorization?.split(' ')[1];
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const session = await clerk.sessions.verifySession({ sessionId: sessionToken });
    req.userId = session.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid session' });
  }
};

// POST /api/log - log admin action with IP
app.post('/api/log', requireAuth, (req, res) => {
  const { action, details } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] Admin ${req.userId} | ${action} | ${details} | IP: ${ip}`);
  // For hackathon, just log. In production, store in DB.
  res.json({ success: true });
});

// GET /api/gold-price - mock price feed
app.get('/api/gold-price', (req, res) => {
  const usdPerGram = 64.0; // ~$2000/oz
  const inrPerUSD = 83.0;
  res.json({
    usd: usdPerGram,
    inr: usdPerGram * inrPerUSD,
    timestamp: Date.now()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
