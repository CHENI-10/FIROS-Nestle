require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const dashboardRoutes = require('./routes/dashboard');
const { startFRSJob } = require('./jobs/recalculateFRSJob');
const { recalculateAllBatches } = require('./services/frsService');
const pool = require('./config/db');

const app = express();

const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL
    ].filter(Boolean)
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all origins for now
    }
  },
  credentials: true
}

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, '../../frontend/build')))
  
  // For any route not matched by API, serve React app
  app.get('/:path*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/build', 'index.html'))
  })
}

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
