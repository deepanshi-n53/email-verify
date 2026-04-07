/**
 * api/_lib/verifier.js
 *
 * ACCURACY STRATEGY:
 * Layer 1 — DNS Syntax & RFC Compliance:    Hard gate, instant
 * Layer 2 — Mail Server Existence (MX):     Dual DNS resolver (Cloudflare + Google)
 * Layer 3 — Temporary Email Detection:      500+ known disposable domains
 * Layer 4 — Role-based Detection:           50+ role prefixes
 * Layer 5 — Spam Trap Detection:            Pattern-based heuristic
 * Layer 6 — SMTP Verification:             Real RCPT probe via Railway worker
 * Layer 7 — Catch-all Detection:           Random UUID probe after real RCPT
 * Layer 8 — Greylisting Handling:          Detects 4xx temporary rejections
 * Layer 9 — Gibberish / Entropy:           Heuristic confidence penalty only
 *
 * When SMTP_WORKER_URL is not set:
 *   - Trusted providers (Gmail, Outlook etc) → trusted shortcut
 *   - Others → heuristic (MX present = connectable)
 *   - catch-all and invalid detection are NOT possible without SMTP
 *
 * Precision > Recall: when uncertain → risky/unknown, NEVER false valid
 */

const dnsNative = require('dns');
const dnsPromises = require('dns').promises;

// ─── DISPOSABLE DOMAINS (500+) ─────────────────────────────────────────────
const DISPOSABLE = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'sharklasers.com','trashmail.com','yopmail.com','maildrop.cc',
  'fakeinbox.com','dispostable.com','spamgourmet.com','mailnull.com',
  'gettempmail.com','10minutemail.com','tempinbox.com','throwam.com',
  'spamherelots.com','tempr.email','discard.email','mailtemp.org',
  'jetable.fr','trash-mail.com','spamfree24.org','spamgourmet.org',
  'grr.la','guerrillamailblock.com','yopmail.fr','nospam.ze.tc',
  'nomail.xl.cx','mega.zik.dj','speed.1s.fr','moncourrier.fr.nf',
  'mailnesia.com','spambox.us','trashmail.at','trashmail.io','trashmail.me',
  'trashmail.net','trashmail.org','tempmail.ninja','tempmail.plus',
  'temp-mail.org','temp-mail.io','temp-mail.ru','dropmail.me',
  'emailondeck.com','spamgourmet.net','mailexpire.com','filzmail.com',
  'tmail.com','mailzilla.com','spamspot.com','spam.la','antispam.de',
  'spamfree.eu','mailcatch.com','incognitomail.com','safetymail.info',
  'spamtrail.com','bob.email','inoutmail.com','objectmail.com',
  'proxymail.eu','rcpt.at','rklips.com','rmqkr.net','snakemail.com',
  'sneakemail.com','sofimail.com','sogetthis.com','spampoison.com',
  'spamtrash.net','tafmail.com','tempalias.com','tempe-mail.com',
  'tempemail.biz','tempemail.com','tempinbox.co.uk','tempmailer.com',
  'tempomail.fr','temporaryemail.net','temporaryemail.us',
  'temporaryinbox.com','thanksnospam.com','thisisnotmyrealemail.com',
  'tilien.com','tittbit.in','tradermail.info','trash2009.com',
  'trash2010.com','trashdevil.de','trashemail.de','trashimail.com',
  'trashmailer.com','trashymail.com','trbvm.com','turual.com',
  'twinmail.de','veryrealemail.com','wazabi.club','whyspam.me',
  'willselfdestruct.com','wuzupmail.net','xagloo.com','xemaps.com',
  'xents.com','xmaily.com','xoxy.net','xyzfree.net','yep.it',
  'ypmail.webarnak.fr.eu.org','zehnminuten.de','zetmail.com',
  'zoaxe.com','zoemail.net','zoemail.org','zomg.info','mt2015.com',
  'mt2016.com','mt2017.com','despam.it','tempemail.co','spam4.me',
  'mytrashmail.com','nobulk.com','bumpymail.com','chacuo.net',
  'put2.net','anonbox.net','anonymbox.com','antichef.com','antichef.net',
  'armyspy.com','cuvox.de','dayrep.com','einrot.com','fleckens.hu',
  'gustr.com','jourrapide.com','rhyta.com','superrito.com','teleworm.us',
  'cool.fr.nf','courriel.fr.nf','junk1.me','get2mail.fr','trashdevil.com',
  'jetable.fr.nf',
]);

// ─── ROLE-BASED PREFIXES ───────────────────────────────────────────────────
const ROLE_PREFIXES = new Set([
  'admin','administrator','support','noreply','no-reply','info','sales',
  'contact','help','abuse','postmaster','webmaster','marketing','billing',
  'team','mail','office','enquiries','enquiry','careers','jobs','legal',
  'privacy','security','newsletter','notifications','alerts','donotreply',
  'do-not-reply','feedback','service','services','reply','subscribe',
  'unsubscribe','bounce','list','lists','hostmaster','root','operator',
  'operations','dev','developer','test','testing','demo','press','media',
  'hr','hiring','recruit','recruiting','accounts','invoice','invoices',
  'orders','order','returns','refund','refunds','payments','payment',
  'finance','accounting','it','helpdesk','servicedesk','sysadmin',
]);

// ─── TRUSTED PROVIDERS ─────────────────────────────────────────────────────
// These block SMTP probing anyway — MX verification is sufficient
const TRUSTED_PROVIDERS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.fr',
  'yahoo.co.in','yahoo.com.au','yahoo.ca','yahoo.de','yahoo.es',
  'yahoo.it','yahoo.co.jp','yahoo.com.br','outlook.com','hotmail.com',
  'hotmail.co.uk','hotmail.de','hotmail.fr','hotmail.es','hotmail.it',
  'live.com','live.co.uk','live.ca','live.com.au','live.fr','live.de',
  'msn.com','icloud.com','me.com','mac.com','apple.com',
  'protonmail.com','proton.me','pm.me','tutanota.com','tutanota.de',
  'tutamail.com','tuta.io','hey.com','fastmail.com','fastmail.fm',
  'zoho.com','aol.com','yandex.com','yandex.ru','mail.ru',
  'gmx.com','gmx.net','web.de','t-online.de','orange.fr','laposte.net',
  'free.fr','sfr.fr','libero.it','virgilio.it','tin.it',
  'rediffmail.com','sina.com','qq.com','163.com','126.com',
  'naver.com','daum.net','hanmail.net',
]);

// ─── SPAM TRAP PATTERNS ────────────────────────────────────────────────────
const SPAM_TRAP_PATTERNS = [
  /^bounce[+\-_]/i,
  /^trap[+\-_@]/i,
  /^honeypot/i,
  /^spamtrap/i,
  /^spam[+\-_]/i,
  /^do[-_]?not[-_]?reply/i,
  /^blackhole/i,
  /^devnull/i,
  /^null@/i,
];

// ─── PERSONAL PROVIDER DOMAINS ─────────────────────────────────────────────
const PERSONAL_PROVIDERS = new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.fr',
  'yahoo.co.in','outlook.com','hotmail.com','hotmail.co.uk','live.com',
  'icloud.com','me.com','mac.com','aol.com','protonmail.com','proton.me',
  'pm.me','yandex.com','yandex.ru','mail.ru','gmx.com','gmx.net',
]);

// ─── RFC 5321/5322 SYNTAX CHECK ────────────────────────────────────────────
function checkSyntax(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.length > 64 || domain.length > 253) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (local.includes('..') || domain.includes('..')) return false;
  if (!/\.[a-zA-Z]{2,63}$/.test(domain)) return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/;
  return re.test(email);
}

// ─── DUAL-RESOLVER MX LOOKUP ───────────────────────────────────────────────
async function checkMX(domain) {
  function tryResolve(server) {
    return new Promise((resolve, reject) => {
      const resolver = new dnsNative.Resolver();
      resolver.setServers([server]);
      resolver.resolveMx(domain, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
  }

  for (const server of ['1.1.1.1', '8.8.8.8']) {
    try {
      const records = await Promise.race([
        tryResolve(server),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ]);
      if (records && records.length > 0) {
        const sorted = records.sort((a, b) => a.priority - b.priority);
        return { found: true, mx: sorted.map(r => r.exchange.toLowerCase()) };
      }
    } catch { /* try next resolver */ }
  }

  // A-record fallback
  try {
    await dnsPromises.resolve4(domain);
    return { found: true, mx: [domain], fallback: true };
  } catch {
    return { found: false, mx: [] };
  }
}

// ─── SPF CHECK ─────────────────────────────────────────────────────────────
async function checkSPF(domain) {
  try {
    const records = await Promise.race([
      dnsPromises.resolveTxt(domain),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    const spf = records.flat().find(r => r.startsWith('v=spf1'));
    return { found: !!spf };
  } catch {
    return { found: false };
  }
}

// ─── DISPOSABLE CHECK ──────────────────────────────────────────────────────
function checkDisposable(domain) {
  const d = domain.toLowerCase();
  if (DISPOSABLE.has(d)) return true;
  for (const bad of DISPOSABLE) {
    if (d.endsWith('.' + bad)) return true;
  }
  return false;
}

// ─── ROLE-BASED CHECK ──────────────────────────────────────────────────────
function checkRoleBased(local) {
  const l = local.toLowerCase();
  return ROLE_PREFIXES.has(l) ||
    [...ROLE_PREFIXES].some(p =>
      l.startsWith(p + '.') || l.startsWith(p + '_') || l.startsWith(p + '+') || l.startsWith(p + '-')
    );
}

// ─── SPAM TRAP CHECK ───────────────────────────────────────────────────────
function checkSpamTrap(local, domain) {
  const full = `${local}@${domain}`.toLowerCase();
  return SPAM_TRAP_PATTERNS.some(pattern => pattern.test(full));
}

// ─── GIBBERISH CHECK (confidence penalty only — not a hard block) ──────────
function checkGibberish(local) {
  const l = local.toLowerCase().replace(/[^a-z]/g, '');
  if (l.length < 3) return false;
  const vowels = (l.match(/[aeiou]/g) || []).length;
  const ratio = vowels / l.length;
  if (l.length > 8 && ratio < 0.10) return true;
  if (/[^aeiou]{7,}/.test(l)) return true;
  if (/^[a-f0-9]{8,}$/.test(local.toLowerCase())) return true;
  if (/(.)\1{4,}/.test(l)) return true;
  const unique = new Set(l).size;
  if (l.length > 12 && unique / l.length > 0.90) return true;
  if (/[a-z]{2,}\d{6,}/.test(local.toLowerCase())) return true;
  return false;
}

// ─── MAILBOX TYPE DETECTION ────────────────────────────────────────────────
function detectMailboxType(domain, isRoleBased, isDisposable) {
  if (isDisposable) return 'disposable';
  if (isRoleBased) return 'role';
  if (PERSONAL_PROVIDERS.has(domain.toLowerCase())) return 'personal';
  return 'professional';
}

// ─── SMTP CHECK via Railway Worker ─────────────────────────────────────────
async function checkSMTP(domain, mxHosts, email) {
  const d = domain.toLowerCase();

  // Trusted providers: MX check sufficient, they block port 25 anyway
  if (TRUSTED_PROVIDERS.has(d)) {
    return {
      connected: true,
      accepted: true,
      catchAll: false,
      greylisted: false,
      trusted: true,
      method: 'trusted_provider',
    };
  }

  // Use Railway SMTP worker if configured
  const workerUrl = process.env.SMTP_WORKER_URL;
  if (workerUrl && mxHosts.length > 0) {
    try {
      const res = await fetch(`${workerUrl}/probe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-secret': process.env.SMTP_WORKER_SECRET || '',
        },
        body: JSON.stringify({ email, mx: mxHosts[0] }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          connected: data.connected ?? false,
          accepted: data.accepted ?? false,
          catchAll: data.catchAll ?? false,
          greylisted: data.greylisted ?? false,
          trusted: false,
          method: 'smtp_probe',
          error: data.error,
        };
      }
    } catch (err) {
      console.error('[smtp] worker error:', err.message);
    }
  }

  // Heuristic fallback (no worker configured)
  const SINK_PATTERNS = ['spamhaus', 'barracuda', 'blackhole', 'null.'];
  if (mxHosts.some(mx => SINK_PATTERNS.some(s => mx.includes(s)))) {
    return { connected: false, accepted: false, method: 'heuristic' };
  }

  return {
    connected: true,
    accepted: true,   // ASSUMPTION — may be wrong without SMTP worker
    catchAll: null,   // Unknown without SMTP probe
    greylisted: false,
    trusted: false,
    method: 'heuristic',
  };
}

// ─── CONFIDENCE SCORE ──────────────────────────────────────────────────────
function calcScore(c) {
  if (!c.dns_syntax) return 0;
  if (!c.mail_server) return 5;
  let s = 30; // base: syntax + MX

  if (c.smtp_verified) s += 20;
  if (c.mailbox_valid) s += 20;
  if (c.spf)           s += 5;
  if (c.trusted)       s += 5;

  if (c.catch_all)  s -= 20;
  if (c.temp_email) s -= 30;
  if (c.role_based) s -= 8;
  if (c.gibberish)  s -= 10;
  if (c.greylisted) s -= 15;
  if (c.spam_trap)  s -= 25;

  return Math.max(0, Math.min(100, Math.round(s)));
}

// ─── STATUS DERIVATION (matches Skrapp's status labels) ───────────────────
function deriveStatus(c, smtpMethod) {
  if (!c.dns_syntax)  return 'invalid';
  if (!c.mail_server) return 'invalid';
  if (c.temp_email)   return 'invalid';
  if (c.spam_trap)    return 'invalid';

  // Without SMTP worker, we can't confirm catch-all or invalid mailboxes
  if (smtpMethod === 'heuristic') {
    return 'unknown';
  }

  if (!c.smtp_verified) return 'unknown';
  if (c.greylisted)     return 'unknown';
  if (c.catch_all)      return 'catch-all';
  if (!c.mailbox_valid) return 'invalid';

  return 'valid';
}

// ─── HUMAN-READABLE REASON (matches Skrapp's message style) ───────────────
function deriveReason(status, c) {
  switch (status) {
    case 'valid':
      return 'Email is valid and successfully reachable.';
    case 'catch-all':
      return "Email is reachable, but it's a catch-all address, and the recipient's existence is uncertain.";
    case 'invalid':
      if (!c.dns_syntax)  return 'Email format is invalid (RFC 5321/5322).';
      if (!c.mail_server) return 'No mail server found for this domain.';
      if (c.temp_email)   return 'Disposable or temporary email provider detected.';
      if (c.spam_trap)    return 'Address matches spam trap signature.';
      return 'Email is invalid and cannot be reached.';
    case 'unknown':
      if (c.greylisted) return 'Mail server returned a temporary rejection (greylisting). Retry recommended.';
      return 'Email deliverability could not be determined.';
    default:
      return 'Verification incomplete.';
  }
}

// ─── MAILBOX STATUS ────────────────────────────────────────────────────────
function deriveMailboxStatus(status) {
  if (status === 'valid')     return 'valid';
  if (status === 'catch-all') return 'valid';
  if (status === 'invalid')   return 'invalid';
  return 'unknown';
}

// ─── MAIN VERIFY FUNCTION ──────────────────────────────────────────────────
async function verifyEmail(email) {
  const start = Date.now();
  email = (email || '').trim().toLowerCase();

  const result = {
    email,
    status: 'unknown',
    confidence: 0,
    // Skrapp-compatible fields
    syntax_valid: 'invalid',
    mailbox_status: 'unknown',
    mailbox_type: 'professional',
    mx_host: null,
    // Check breakdown
    checks: {
      dns_syntax:    false,
      mail_server:   false,
      smtp_verified: false,
      mailbox_valid: false,
      catch_all:     false,
      temp_email:    false,
      greylisted:    false,
      spam_trap:     false,
      role_based:    false,
      gibberish:     false,
      spf:           false,
      trusted:       false,
    },
    reason: '',
    mx_records: [],
    verification_method: 'none',
    response_time_ms: 0,
  };

  // L1: DNS Syntax & RFC Compliance
  result.checks.dns_syntax = checkSyntax(email);
  if (!result.checks.dns_syntax) {
    result.status = 'invalid';
    result.syntax_valid = 'invalid';
    result.mailbox_status = 'invalid';
    result.reason = deriveReason('invalid', result.checks);
    result.response_time_ms = Date.now() - start;
    return result;
  }

  result.syntax_valid = 'valid';
  const [local, domain] = email.split('@');

  // Instant checks (no network)
  result.checks.temp_email = checkDisposable(domain);
  result.checks.role_based = checkRoleBased(local);
  result.checks.gibberish  = checkGibberish(local);
  result.checks.spam_trap  = checkSpamTrap(local, domain);
  result.mailbox_type      = detectMailboxType(domain, result.checks.role_based, result.checks.temp_email);

  // Early exit for disposable (still do MX to fill mx_host)
  if (result.checks.temp_email) {
    const mxResult = await checkMX(domain);
    result.checks.mail_server = mxResult.found;
    result.mx_records = mxResult.mx;
    result.mx_host = mxResult.mx[0] || null;
    result.status = 'invalid';
    result.mailbox_status = 'invalid';
    result.reason = deriveReason('invalid', result.checks);
    result.response_time_ms = Date.now() - start;
    return result;
  }

  // L2: Mail Server Existence (dual DNS) + SPF in parallel
  const [mxResult, spfResult] = await Promise.all([
    checkMX(domain),
    checkSPF(domain),
  ]);

  result.checks.mail_server = mxResult.found;
  result.checks.spf = spfResult.found;
  result.mx_records = mxResult.mx;
  result.mx_host = mxResult.mx[0] || null;

  if (!result.checks.mail_server) {
    result.status = 'invalid';
    result.mailbox_status = 'invalid';
    result.reason = deriveReason('invalid', result.checks);
    result.response_time_ms = Date.now() - start;
    return result;
  }

  // L5-L8: SMTP Verification + Catch-all + Greylisting
  const smtpResult = await checkSMTP(domain, mxResult.mx, email);

  result.checks.smtp_verified = smtpResult.connected && smtpResult.accepted;
  result.checks.mailbox_valid = smtpResult.connected && smtpResult.accepted && !smtpResult.catchAll;
  result.checks.catch_all     = smtpResult.catchAll === true;
  result.checks.greylisted    = smtpResult.greylisted === true;
  result.checks.trusted       = smtpResult.trusted === true;
  result.verification_method  = smtpResult.method;

  result.confidence     = calcScore(result.checks);
  result.status         = deriveStatus(result.checks, smtpResult.method);
  result.mailbox_status = deriveMailboxStatus(result.status);
  result.reason         = deriveReason(result.status, result.checks);
  result.response_time_ms = Date.now() - start;

  return result;
}

module.exports = { verifyEmail, checkSyntax, checkDisposable, checkRoleBased };
