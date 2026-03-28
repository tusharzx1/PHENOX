require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../db');
const logger = require('../utils/logger');

const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '001_init.sql');

async function runMigration() {
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await db.query(sql);
    logger.info('Migration completed: %s', migrationPath);
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed: %s', error.message);
    process.exit(1);
  } finally {
    await db.closePool().catch(() => {});
  }
}

runMigration();
