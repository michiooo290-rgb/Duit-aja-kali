// ============================================
// DUIT TRACKER PRO — App Factory
// Express setup, middleware, and route mounting.
// Exports the app itself (no app.listen here) so it can be
// used both by Vercel serverless functions and by server.js
// for local development.
// ============================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const path    = require('path');

const app = express();

// ── Database Pool ────────────────────────────
// NOTE: on Vercel, prefer a *pooled* connection string
// (e.g. Supabase's connection pooler on port 6543 / pgbouncer mode)
// instead of a direct connection, to avoid exhausting DB connections
// across serverless invocations.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // required for Supabase / Railway
});

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Controller & Routes ──────────────────────
const createController = require('../controllers/transactionController');
const createRouter     = require('../routes/index');

const controller = createController(pool);
const apiRouter  = createRouter(controller);

// Lazily initialize the DB once per warm serverless instance,
// instead of blocking module load (which app.listen used to do before).
let dbReadyPromise = null;
function ensureDbReady() {
  if (!dbReadyPromise) {
    dbReadyPromise = controller.initDB().catch((err) => {
      dbReadyPromise = null; // allow retry on next request if it failed
      throw err;
    });
  }
  return dbReadyPromise;
}

app.use('/api', (req, res, next) => {
  ensureDbReady().then(() => next()).catch(next);
});
app.use('/api', apiRouter);

// ── Fallback to index.html (SPA) ─────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
