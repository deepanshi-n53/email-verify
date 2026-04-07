/**
 * api/health.js
 * GET /api/health
 * Returns service status + version info.
 */

const { withCors } = require('./_lib/cors');

module.exports = withCors(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    service: 'MailProbe API',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'production',
    features: {
      single_verify: true,
      bulk_verify: true,
      smtp_worker: !!process.env.SMTP_WORKER_URL,
      kv_cache: !!process.env.KV_REST_API_URL,
    },
  });
});
