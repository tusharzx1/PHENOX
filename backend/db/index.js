const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

const getPool = () => {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected PostgreSQL idle client error: %s', err.message);
  });

  return pool;
};

const query = async (text, params = []) => {
  const activePool = getPool();
  return activePool.query(text, params);
};

const checkDbHealth = async () => {
  try {
    await query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

const closePool = async () => {
  if (!pool) return;
  await pool.end();
  pool = null;
};

module.exports = {
  checkDbHealth,
  closePool,
  getPool,
  query,
};
