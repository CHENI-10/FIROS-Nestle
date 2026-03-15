require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const { startFRSJob } = require('./jobs/recalculateFRSJob');
const { recalculateAllBatches } = require('./services/frsService');
const pool = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startFRSJob();
    recalculateAllBatches(pool).then(() => {
        console.log('[Server] Initial FRS recalculation complete');
    });
});
