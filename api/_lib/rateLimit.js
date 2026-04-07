/**
 * api/_lib/rateLimit.js
 * Simple in-memory sliding window rate limiter.
 * For production: replace with Vercel KV (Redis-backed) for persistence across instances.
 *
 * Usage:
 *   const { rateLimit } = require('./_lib/rateLimit');
 *   const { allowed, remaining, reset } = rateLimit(identifier, limit, windowMs);
 */

// In-memory store — resets on cold start (acceptable for free tier demo)
// For prod: use @vercel/kv or upstash/redis
const store = new Map();

/**
 * Sliding window rate limiter
 * @param {string} key      - identifier (IP or API key)
 * @param {number} limit    - max requests per window
 * @param {number} windowMs - window size in milliseconds
 */
function rateLimit(key, limit = 100, windowMs = 86400000 /* 24h */) {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!store.has(key)) {
    store.set(key, []);
  }

  // Prune old timestamps outside the window
  const timestamps = store.get(key).filter(t => t > windowStart);
  timestamps.push(now);
  store.set(key, timestamps);

  const count = timestamps.length;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const reset = Math.ceil((timestamps[0] + windowMs - now) / 1000); // seconds until oldest expires

  // Cleanup: evict keys not used in last 2 windows
  if (store.size > 10000) {
    for (const [k, ts] of store.entries()) {
      if (ts[ts.length - 1] < now - windowMs * 2) store.delete(k);
    }
  }

  return { allowed, remaining, reset, count, limit };
}

/**
 * Get client IP from Vercel request headers
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Validate API key (simple — replace with DB lookup for real keys)
 * In prod: store hashed keys in Vercel KV or Postgres
 */
function validateApiKey(req) {
  const key = req.headers['x-api-key'] || req.query?.apikey;
  if (!key) return { valid: false, tier: 'anonymous' };

  // Demo: accept any key starting with 'mp_' as pro tier
  if (key.startsWith('mp_live_')) return { valid: true, tier: 'pro', key };
  if (key.startsWith('mp_free_')) return { valid: true, tier: 'free', key };

  // In production, check against DB:
  // const user = await db.query('SELECT * FROM api_keys WHERE key_hash = $1', [hash(key)]);
  return { valid: false, tier: 'anonymous' };
}

/**
 * Express/Vercel middleware factory
 */
function createRateLimitMiddleware(options = {}) {
  const {
    limit = parseInt(process.env.RATE_LIMIT_FREE || '100'),
    windowMs = 86400000,
    message = 'Rate limit exceeded. Free tier: 100 verifications/day. Upgrade at mailprobe.io',
  } = options;

  return function withRateLimit(req, res, handler) {
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const ip = getClientIp(req);
    const apiKey = req.headers['x-api-key'] || req.query?.apikey;

    // Pro API keys get higher limits
    const identifier = apiKey ? `key:${apiKey}` : `ip:${ip}`;
    const effectiveLimit = apiKey ? 10000 : limit;

    const rl = rateLimit(identifier, effectiveLimit, windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rl.limit);
    res.setHeader('X-RateLimit-Remaining', rl.remaining);
    res.setHeader('X-RateLimit-Reset', rl.reset);

    if (!rl.allowed) {
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message,
        limit: rl.limit,
        remaining: 0,
        reset_in_seconds: rl.reset,
        upgrade_url: 'https://mailprobe.io/pricing',
      });
      return;
    }

    return handler(req, res);
  };
}

module.exports = { rateLimit, getClientIp, validateApiKey, createRateLimitMiddleware };
