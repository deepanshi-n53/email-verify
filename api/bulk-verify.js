/**
 * api/bulk-verify.js
 * POST /api/bulk-verify
 *
 * Body: { "emails": ["a@b.com", "c@d.com", ...], "options": { "filter": "all" } }
 *
 * Vercel function max duration: 30s (Pro plan gives 60s).
 * For 10k+ emails: use the job queue pattern — POST creates a job,
 * GET /api/jobs/:id polls status. This endpoint handles up to 200 synchronously.
 *
 * Free tier: 100 emails/day
 * Pro tier:  unlimited (with SMTP worker)
 */

const { verifyEmail } = require('./_lib/verifier');
const { withCors } = require('./_lib/cors');
const { createRateLimitMiddleware, getClientIp } = require('./_lib/rateLimit');

const FREE_BULK_LIMIT = parseInt(process.env.FREE_BULK_LIMIT || '50');
const PRO_BULK_LIMIT  = parseInt(process.env.PRO_BULK_LIMIT  || '500');
const CONCURRENCY     = parseInt(process.env.BULK_CONCURRENCY || '10');

// Rate limit: 1 bulk job per 5 minutes per IP (free tier)
const withRateLimit = createRateLimitMiddleware({ limit: 12, windowMs: 3600000 });

/**
 * Process emails with controlled concurrency (no Promise.all overload)
 */
async function processWithConcurrency(emails, concurrency, onProgress) {
  const results = new Array(emails.length);
  let index = 0;

  async function worker() {
    while (index < emails.length) {
      const i = index++;
      results[i] = await verifyEmail(emails[i]);
      if (onProgress) onProgress(i + 1, emails.length, results[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, emails.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'POST only' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const { emails, options = {} } = body || {};

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({
      error: 'missing_emails',
      message: 'Provide { "emails": ["a@b.com", ...] } in request body',
    });
  }

  // Check API key for limit
  const apiKey = req.headers['x-api-key'];
  const isPro  = apiKey?.startsWith('mp_live_');
  const limit  = isPro ? PRO_BULK_LIMIT : FREE_BULK_LIMIT;

  if (emails.length > limit) {
    return res.status(400).json({
      error: 'too_many_emails',
      message: `Free tier: max ${FREE_BULK_LIMIT} emails per request. Pro: ${PRO_BULK_LIMIT}. You sent ${emails.length}.`,
      limit,
      sent: emails.length,
      upgrade_url: 'https://mailprobe.io/pricing',
    });
  }

  // Deduplicate
  const unique = [...new Set(emails.map(e => (e || '').trim().toLowerCase()).filter(Boolean))];

  const startTime = Date.now();
  let processed = 0;

  try {
    const results = await processWithConcurrency(unique, CONCURRENCY, (n) => { processed = n; });

    // Aggregate stats
    const stats = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, { valid: 0, invalid: 0, risky: 0, unknown: 0 });

    // Optional filtering
    let output = results;
    if (options.filter === 'valid') output = results.filter(r => r.status === 'valid');
    if (options.filter === 'risky_or_valid') output = results.filter(r => r.status !== 'invalid');

    return res.status(200).json({
      total_submitted: emails.length,
      total_unique: unique.length,
      total_processed: results.length,
      stats,
      processing_time_ms: Date.now() - startTime,
      results: output,
    });
  } catch (err) {
    console.error('[bulk-verify] error:', err.message);
    return res.status(500).json({
      error: 'bulk_verification_failed',
      message: err.message,
      processed,
    });
  }
}

module.exports = withCors((req, res) => withRateLimit(req, res, handler));
