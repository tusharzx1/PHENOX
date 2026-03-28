const db = require('../db');
const { getBlockchain, isBlockchainReady } = require('./blockchain');

const getHealthSnapshot = async () => {
  const dbHealth = await db.checkDbHealth();

  let blockchain = {
    ok: false,
    blockNumber: null,
    initializedAt: null,
    error: 'Blockchain not initialized',
  };

  if (isBlockchainReady()) {
    try {
      const chain = getBlockchain();
      const blockNumber = await chain.provider.getBlockNumber();
      blockchain = {
        ok: true,
        blockNumber,
        initializedAt: chain.initializedAt,
        error: null,
      };
    } catch (error) {
      blockchain = {
        ok: false,
        blockNumber: null,
        initializedAt: null,
        error: error.message,
      };
    }
  }

  const ok = dbHealth.ok && blockchain.ok;

  return {
    ok,
    services: {
      database: dbHealth,
      blockchain,
    },
    timestamp: new Date().toISOString(),
  };
};

module.exports = { getHealthSnapshot };
