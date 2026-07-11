// ============================================
// DUIT TRACKER PRO — API Routes
// All endpoint definitions, delegates to controllers
// ============================================
const express = require('express');

/**
 * Creates the API router with the given controller.
 * @param {Object} controller - controller methods from transactionController.js
 * @returns {express.Router}
 */
module.exports = function createRouter(controller) {
  const router = express.Router();

  // ── Auth ──
  router.post('/login',      controller.login);
  router.post('/change-pin', controller.changePin);

  // ── Settings ──
  router.get('/settings',    controller.getSettings);
  router.post('/settings',   controller.saveSettings);

  // ── Transactions ──
  router.get('/transactions',       controller.getTransactions);
  router.post('/transactions',      controller.createTransaction);
  router.delete('/transactions/:id', controller.deleteTransaction);
  router.delete('/transactions',    controller.deleteAllTransactions);

  // ── Health Check ──
  router.get('/health', controller.healthCheck);

  return router;
};
