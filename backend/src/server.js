require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const dashboardRoutes = require('./routes/dashboard');
const { startFRSJob } = require('./jobs/recalculateFRSJob');
const { recalculateAllBatches } = require('./services/frsService');
const pool = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startFRSJob();
    // 3. Initial Recalculation (Non-blocking)
    recalculateAllBatches(pool).then(() => {
        console.log('[Server] Initial FRS recalculation complete');
    }).catch(err => {
        console.error('[Server] Initial FRS recalculation failed (will retry on next cron):', err.message);
    });
});
