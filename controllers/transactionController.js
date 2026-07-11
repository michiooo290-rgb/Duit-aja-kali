// ============================================
// DUIT TRACKER PRO — Transaction Controller
// Business logic for all API endpoints
// ============================================
const bcrypt = require('bcryptjs');

/**
 * Creates controller functions with the given database pool.
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @returns {Object} controller methods
 */
module.exports = function createController(pool) {

  // ── Database Initialization (runs once on server start) ──
  async function initDB() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id       BIGINT PRIMARY KEY,
          type     TEXT    NOT NULL,
          wallet   TEXT    NOT NULL,
          cat      TEXT    NOT NULL,
          descr    TEXT    NOT NULL,
          amount   NUMERIC NOT NULL,
          date     TEXT    NOT NULL,
          ratio    TEXT    NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Initialize default PIN if not exists
      const pinRow = await pool.query(`SELECT value FROM settings WHERE key = 'pin'`);
      if (pinRow.rowCount === 0) {
        const defaultPin = process.env.DEFAULT_PIN || '1234';
        const hashed = await bcrypt.hash(defaultPin, 10);
        await pool.query(`INSERT INTO settings (key, value) VALUES ('pin', $1)`, [hashed]);
        console.log('✅ Default PIN created:', defaultPin);
      }

      // Initialize default name if not exists
      const nameRow = await pool.query(`SELECT value FROM settings WHERE key = 'name'`);
      if (nameRow.rowCount === 0) {
        await pool.query(`INSERT INTO settings (key, value) VALUES ('name', 'Pengguna')`);
      }

      console.log('✅ Database ready');
    } catch (err) {
      console.error('❌ Failed to initialize database:', err.message);
      process.exit(1);
    }
  }

  // ============================================
  // AUTH
  // ============================================

  // POST /api/login — verify PIN
  async function login(req, res) {
    try {
      const { pin } = req.body;
      if (!pin) return res.status(400).json({ ok: false, message: 'PIN wajib diisi' });

      const row = await pool.query(`SELECT value FROM settings WHERE key = 'pin'`);
      if (row.rowCount === 0) return res.status(500).json({ ok: false, message: 'PIN belum dikonfigurasi' });

      const valid = await bcrypt.compare(String(pin), row.rows[0].value);
      if (!valid) return res.status(401).json({ ok: false, message: 'PIN salah' });

      // Fetch name & settings together
      const nameRow   = await pool.query(`SELECT value FROM settings WHERE key = 'name'`);
      const budgetRow = await pool.query(`SELECT value FROM settings WHERE key = 'budget'`);

      res.json({
        ok: true,
        name:   nameRow.rows[0]?.value   || 'Pengguna',
        budget: budgetRow.rows[0]?.value || '0'
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // POST /api/change-pin — change PIN
  async function changePin(req, res) {
    try {
      const { oldPin, newPin } = req.body;
      if (!oldPin || !newPin) return res.status(400).json({ ok: false, message: 'Data tidak lengkap' });
      if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ ok: false, message: 'PIN harus 4 angka' });

      const row = await pool.query(`SELECT value FROM settings WHERE key = 'pin'`);
      const valid = await bcrypt.compare(String(oldPin), row.rows[0].value);
      if (!valid) return res.status(401).json({ ok: false, message: 'PIN lama salah' });

      const hashed = await bcrypt.hash(newPin, 10);
      await pool.query(`UPDATE settings SET value = $1 WHERE key = 'pin'`, [hashed]);
      res.json({ ok: true, message: 'PIN berhasil diubah' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // ============================================
  // SETTINGS
  // ============================================

  // GET /api/settings — get all settings
  async function getSettings(req, res) {
    try {
      const rows = await pool.query(`SELECT key, value FROM settings WHERE key != 'pin'`);
      const data = {};
      rows.rows.forEach(r => { data[r.key] = r.value; });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // POST /api/settings — save a setting (name/budget/reminders)
  async function saveSettings(req, res) {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ ok: false, message: 'Key wajib diisi' });

      await pool.query(`
        INSERT INTO settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [key, String(value)]);

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  // GET /api/transactions — get all transactions
  async function getTransactions(req, res) {
    try {
      const result = await pool.query(`
        SELECT id, type, wallet, cat, descr AS desc, amount, date, ratio
        FROM transactions
        ORDER BY date DESC, id DESC
      `);
      // Convert amount to number
      const rows = result.rows.map(r => ({ ...r, amount: parseFloat(r.amount), id: Number(r.id) }));
      res.json({ ok: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // POST /api/transactions — create new transaction
  async function createTransaction(req, res) {
    try {
      const { id, type, wallet, cat, desc, amount, date, ratio } = req.body;
      if (!type || !wallet || !cat || !desc || !amount || !date || !ratio) {
        return res.status(400).json({ ok: false, message: 'Data tidak lengkap' });
      }
      const txId = id || Date.now();
      await pool.query(`
        INSERT INTO transactions (id, type, wallet, cat, descr, amount, date, ratio)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [txId, type, wallet, cat, desc, amount, date, ratio]);

      res.json({ ok: true, id: txId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // DELETE /api/transactions/:id — delete a transaction
  async function deleteTransaction(req, res) {
    try {
      const { id } = req.params;
      await pool.query(`DELETE FROM transactions WHERE id = $1`, [id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // DELETE /api/transactions — delete ALL transactions
  async function deleteAllTransactions(req, res) {
    try {
      await pool.query(`DELETE FROM transactions`);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  function healthCheck(req, res) {
    res.json({ ok: true, time: new Date().toISOString() });
  }

  // ── Return all controller methods ──
  return {
    initDB,
    login,
    changePin,
    getSettings,
    saveSettings,
    getTransactions,
    createTransaction,
    deleteTransaction,
    deleteAllTransactions,
    healthCheck
  };
};
