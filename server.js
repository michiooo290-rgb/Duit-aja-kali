// ============================================
// DUIT TRACKER PRO — Main Server
// Express setup, middleware, and route mounting
// ============================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database Pool ────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // required for Supabase / Railway
});

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Controller & Routes ──────────────────────
const createController = require('./controllers/transactionController');
const createRouter     = require('./routes/index');

const controller = createController(pool);
const apiRouter  = createRouter(controller);

app.use('/api', apiRouter);

// ── Fallback to index.html (SPA) ─────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start Server ─────────────────────────────
controller.initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
});
