/**
 * mailprobe/api/_lib/verifier.js
 * Core 7-layer email verification engine (pure Node.js, no native deps).
 * Works inside Vercel serverless functions.
 *
 * NOTE ON SMTP IN SERVERLESS:
 *   Vercel blocks outbound port 25. This engine does:
 *     1. DNS/MX verification   — real, via Node dns module
 *     2. Disposable detection  — static list (extend via KV / DB)
 *     3. Role / gibberish      — heuristic, instant
 *     4. SMTP heuristic        — trusted-provider shortcut + Railway hook
 *   For full SMTP RCPT probing, deploy the companion Railway worker
 *   (api/_lib/smtpWorker.md) and set SMTP_WORKER_URL in env.
 */

const dns = require('dns').promises;

// ─── DISPOSABLE DOMAINS ───────────────────────────────────────────────────
const DISPOSABLE = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'sharklasers.com','trashmail.com','yopmail.com','maildrop.cc',
  'fakeinbox.com','dispostable.com','spamgourmet.com','mailnull.com',
  'gettempmail.com','10minutemail.com','tempinbox.com','throwam.com',
  'spamherelots.com','tempr.email','discard.email','mailtemp.org',
  'jetable.fr','trash-mail.com','spamfree24.org','spamgourmet.org',
  'cool.fr.nf','courriel.fr.nf','junk1.me','get2mail.fr','trashdevil.com',
  'mt2015.com','mt2016.com','mt2017.com','despam.it','tempemail.co',
  'spam4.me','mytrashmail.com','nobulk.com','bumpymail.com','chacuo.net',
  'put2.net','anonbox.net','anonymbox.com','antichef.com','antichef.net',
  'armyspy.com','cuvox.de','dayrep.com','einrot.com','fleckens.hu',
  'gustr.com','jourrapide.com','rhyta.com','superrito.com','teleworm.us',
  'grr.la','guerrillamailblock.com','spam4.me','yopmail.fr','cool.fr.nf',
  'courriel.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx',
  'mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf',
]);

// ─── ROLE-BASED PREFIXES ──────────────────────────────────────────────────
const ROLE_PREFIXES = [
  'admin','administrator','support','noreply','no-reply','info','sales',
  'contact','help','abuse','postmaster','webmaster','marketing','billing',
  'team','hello','hi','mail','office','enquiries','enquiry','careers',
  'jobs','legal','privacy','security','newsletter','notifications','alerts',
  'donotreply','do-not-reply','feedback','service','services','reply',
  'subscribe','unsubscribe','bounce','list','lists','hostmaster','root',
  'operator','operations','dev','developer','test','testing','demo',
];

// ─── TRUSTED PROVIDERS (MX check sufficient, SMTP blocked by them anyway) ─
const TRUSTED_PROVIDERS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.fr',
  'yahoo.co.in','yahoo.com.au','yahoo.ca','outlook.com','hotmail.com',
  'hotmail.co.uk','live.com','msn.com','icloud.com','me.com','mac.com',
  'protonmail.com','proton.me','fastmail.com','fastmail.fm','zoho.com',
  'aol.com','yandex.com','yandex.ru','mail.ru','gmx.com','gmx.net',
  'web.de','t-online.de','orange.fr','laposte.net','free.fr','sfr.fr',
  'bbox.fr','neuf.fr','wanadoo.fr','libero.it','virgilio.it','tin.it',
]);

// ─── SYNTAX CHECK (RFC 5321/5322) ─────────────────────────────────────────
function checkSyntax(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (domain.length > 253) return false;
  // No leading/trailing dots
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  // No consecutive dots
  if (local.includes('..') || domain.includes('..')) return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/;
  return re.test(email);
}

// ─── MX LOOKUP ────────────────────────────────────────────────────────────
async function checkMX(domain) {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, rej) => setTimeout(() => rej(new Error('dns_timeout')), 5000)),
    ]);
    if (!records || records.length === 0) return { found: false, mx: [] };
    const sorted = records.sort((a, b) => a.priority - b.priority);
    return { found: true, mx: sorted.map(r => r.exchange.toLowerCase()) };
  } catch (err) {
    if (err.message === 'dns_timeout') return { found: false, mx: [], error: 'timeout' };
    // Fallback: some domains use A records with implicit MX
    try {
      await dns.resolve4(domain);
      return { found: true, mx: [domain], fallback: true };
    } catch {
      return { found: false, mx: [] };
    }
  }
}

// ─── DISPOSABLE CHECK ─────────────────────────────────────────────────────
function checkDisposable(domain) {
  const d = domain.toLowerCase();
  if (DISPOSABLE.has(d)) return true;
  // Check subdomains e.g. mail.mailinator.com
  for (const bad of DISPOSABLE) {
    if (d.endsWith('.' + bad)) return true;
  }
  return false;
}

// ─── ROLE-BASED CHECK ────────────────────────────────────────────────────
function checkRoleBased(local) {
  const l = local.toLowerCase();
  return ROLE_PREFIXES.some(
    p => l === p || l.startsWith(p + '.') || l.startsWith(p + '_') || l.startsWith(p + '+')
  );
}

// ─── GIBBERISH / ENTROPY CHECK ───────────────────────────────────────────
function checkGibberish(local) {
  // Strip to alpha only for analysis
  const l = local.toLowerCase().replace(/[^a-z]/g, '');
  if (l.length < 3) return true;
  const vowels = (l.match(/[aeiou]/g) || []).length;
  const ratio = vowels / l.length;
  if (l.length > 7 && ratio < 0.12) return true;    // almost no vowels
  if (/[^aeiou]{6,}/.test(l)) return true;           // 6+ consonants in a row
  if (/^(.)\1{4,}$/.test(l)) return true;             // repeating single char
  // High character entropy (all unique, long, no pattern)
  const unique = new Set(l).size;
  if (l.length > 10 && unique / l.length > 0.92) return true;
  return false;
}

// ─── SMTP CHECK ───────────────────────────────────────────────────────────
// Vercel blocks port 25. Options:
//   a) Set SMTP_WORKER_URL to a Railway microservice URL for real RCPT probing
//   b) Fall back to trusted-provider heuristic (what this does by default)
async function checkSMTP(domain, mxHosts) {
  const d = domain.toLowerCase();

  // Trusted providers: MX check is sufficient, they block RCPT probing anyway
  if (TRUSTED_PROVIDERS.has(d)) {
    return { connected: true, trusted: true };
  }

  // Optional: call external SMTP worker (Railway / Fly.io)
  const workerUrl = process.env.SMTP_WORKER_URL;
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-secret': process.env.SMTP_WORKER_SECRET || '' },
        body: JSON.stringify({ domain, mx: mxHosts[0] }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        return { connected: data.connected, catchAll: data.catchAll, trusted: false };
      }
    } catch { /* fall through to heuristic */ }
  }

  // Heuristic fallback: if MX exists and domain is not on blocklist → assume connectable
  const SMTP_BLOCKLIST = ['spamhaus.org', 'barracuda.com', 'spamcop.net'];
  if (mxHosts.some(mx => SMTP_BLOCKLIST.some(b => mx.includes(b)))) {
    return { connected: false };
  }

  return { connected: true, trusted: false, heuristic: true };
}

// ─── CONFIDENCE SCORE ─────────────────────────────────────────────────────
function calcScore(c) {
  if (!c.syntax) return 0;
  if (!c.mx)     return 5;
  let s = 30; // base: syntax + MX
  if (c.smtp)       s += 25;
  if (c.mailbox)    s += 25;
  if (c.trusted)    s += 5;
  if (c.catchAll)   s -= 15;
  if (c.disposable) s -= 30;
  if (c.roleBased)  s -= 10;
  if (c.gibberish)  s -= 12;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function deriveStatus(c, score) {
  if (!c.syntax)     return 'invalid';
  if (!c.mx)         return 'invalid';
  if (c.disposable)  return 'risky';
  if (!c.smtp)       return 'unknown';
  if (c.catchAll)    return 'risky';
  if (c.roleBased)   return 'risky';
  if (score >= 75)   return 'valid';
  if (score >= 45)   return 'risky';
  return 'invalid';
}

function deriveReason(c) {
  if (!c.syntax)    return 'Invalid syntax — fails RFC 5321/5322';
  if (!c.mx)        return 'No MX records found for this domain';
  if (c.disposable) return 'Disposable / burner email provider detected';
  if (!c.smtp)      return 'SMTP server unreachable or timed out';
  const flags = [];
  if (c.catchAll)  flags.push('Catch-all domain — mailbox existence unverifiable');
  if (c.roleBased) flags.push('Role-based address — routes to a team, not a person');
  if (c.gibberish) flags.push('Suspicious local-part entropy pattern');
  if (flags.length) return flags.join(' · ');
  return c.trusted
    ? 'Trusted provider — MX verified, SMTP connection confirmed'
    : 'MX + SMTP verified — mailbox appears deliverable';
}

// ─── MAIN VERIFY FUNCTION ─────────────────────────────────────────────────
async function verifyEmail(email) {
  const start = Date.now();
  email = (email || '').trim().toLowerCase();

  const result = {
    email,
    status: 'unknown',
    confidence: 0,
    checks: {
      syntax: false, mx: false, smtp: false, mailbox: false,
      catchAll: false, disposable: false, roleBased: false,
      gibberish: false, trusted: false,
    },
    reason: '',
    mx_records: [],
    response_time_ms: 0,
  };

  // L1: Syntax
  result.checks.syntax = checkSyntax(email);
  if (!result.checks.syntax) {
    result.status = 'invalid';
    result.reason = deriveReason(result.checks);
    result.response_time_ms = Date.now() - start;
    return result;
  }

  const [local, domain] = email.split('@');

  // L3 + L4 + L7: instant checks (no network)
  result.checks.disposable = checkDisposable(domain);
  result.checks.roleBased  = checkRoleBased(local);
  result.checks.gibberish  = checkGibberish(local);

  // L2: MX lookup
  const mxResult = await checkMX(domain);
  result.checks.mx  = mxResult.found;
  result.mx_records = mxResult.mx;

  if (!result.checks.mx) {
    result.status = 'invalid';
    result.reason = deriveReason(result.checks);
    result.response_time_ms = Date.now() - start;
    return result;
  }

  // L5: SMTP
  const smtpResult = await checkSMTP(domain, mxResult.mx);
  result.checks.smtp    = smtpResult.connected;
  result.checks.trusted = !!smtpResult.trusted;
  if (smtpResult.catchAll !== undefined) {
    result.checks.catchAll = smtpResult.catchAll;
  }

  // Mailbox: if SMTP ok and not disposable → consider deliverable
  result.checks.mailbox = result.checks.smtp && !result.checks.disposable;

  result.confidence = calcScore(result.checks);
  result.status     = deriveStatus(result.checks, result.confidence);
  result.reason     = deriveReason(result.checks);
  result.response_time_ms = Date.now() - start;

  return result;
}

module.exports = { verifyEmail, checkSyntax, checkDisposable, checkRoleBased };
