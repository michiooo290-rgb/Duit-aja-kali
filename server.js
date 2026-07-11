// ============================================
// DUIT TRACKER PRO — Local Dev Server
// Thin wrapper that runs the Express app (from api/index.js)
// with a normal app.listen(). On Vercel, api/index.js is used
// directly as a serverless function and this file is not run.
// ============================================
const app = require('./api/index');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
