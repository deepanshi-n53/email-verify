/**
 * src/lib/api.js
 * Centralized API client. All calls go to /api/* (same origin on Vercel).
 */

const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({ error: 'parse_error', message: res.statusText }));

  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

/**
 * Verify a single email address
 * @param {string} email
 * @param {string} [apiKey]
 * @returns {Promise<VerifyResult>}
 */
export async function verifySingle(email, apiKey) {
  return request(`/api/verify?email=${encodeURIComponent(email)}`, { apiKey });
}

/**
 * Verify a list of emails (bulk)
 * @param {string[]} emails
 * @param {{ filter?: 'all'|'valid'|'risky_or_valid' }} [options]
 * @param {string} [apiKey]
 */
export async function verifyBulk(emails, options = {}, apiKey) {
  return request('/api/bulk-verify', {
    method: 'POST',
    body: JSON.stringify({ emails, options }),
    apiKey,
  });
}

/**
 * Health check
 */
export async function healthCheck() {
  return request('/api/health');
}
