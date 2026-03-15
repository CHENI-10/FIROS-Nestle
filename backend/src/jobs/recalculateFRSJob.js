const cron = require('node-cron');
const { recalculateAllBatches } = require('../services/frsService');
const pool = require('../config/db');

const startFRSJob = () => {
  cron.schedule('*/30 * * * *', async () => {
    console.log('[FRS Job] Running scheduled recalculation...');
    try {
      await recalculateAllBatches(pool);
    } catch (error) {
      console.error('[FRS Job] Error during scheduled recalculation:', error.message);
    }
  });

  console.log('[FRS Job] Scheduled — runs every 30 minutes');
};

module.exports = { startFRSJob };
