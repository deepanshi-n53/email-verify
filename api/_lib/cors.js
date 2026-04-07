/**
 * api/_lib/cors.js
 * CORS + preflight helper for Vercel serverless functions.
 */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);

  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

function withCors(handler) {
  return async function (req, res) {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    return handler(req, res);
  };
}

module.exports = { setCorsHeaders, withCors };
