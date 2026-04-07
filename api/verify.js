/**
 * api/verify.js
 * GET  /api/verify?email=user@example.com
 * POST /api/verify  { "email": "user@example.com" }
 *
 * Optional: &apikey=mp_free_xxxx for higher rate limits.
 *
 * Response:
 * {
 *   email, status, confidence, checks, reason, mx_records, response_time_ms
 * }
 */

const { verifyEmail } = require('./_lib/verifier');
const { withCors } = require('./_lib/cors');
const { createRateLimitMiddleware } = require('./_lib/rateLimit');

const withRateLimit = createRateLimitMiddleware({ limit: 100, windowMs: 86400000 });

async function handler(req, res) {
  // Parse email from GET or POST
  let email;
  if (req.method === 'GET') {
    email = req.query?.email;
  } else if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      email = body?.email;
    } catch {
      return res.status(400).json({ error: 'invalid_json', message: 'Request body must be valid JSON' });
    }
  } else {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Use GET or POST' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      error: 'missing_email',
      message: 'Provide email as query param (?email=...) or POST body { "email": "..." }',
    });
  }

  if (email.length > 320) {
    return res.status(400).json({ error: 'email_too_long', message: 'Email exceeds maximum length' });
  }

  try {
    const result = await verifyEmail(email);
    // Cache successful results for 1 hour in Vercel edge cache
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[verify] error:', err.message);
    return res.status(500).json({
      error: 'verification_failed',
      message: 'Internal verification error. Please retry.',
      email,
    });
  }
}

// Wrap with CORS, then rate limit inside the CORS wrapper
module.exports = withCors((req, res) => withRateLimit(req, res, handler));
