import React from 'react';

// pass(checks) → true means "good" (green), false means "bad" (red/amber)
const CHECKS = [
  { key: 'dns_syntax',    label: 'DNS Syntax & RFC',    pass: c => c.dns_syntax,
    ok: 'RFC 5321/5322 compliant', fail: 'Invalid format' },
  { key: 'mail_server',   label: 'Mail Server',         pass: c => c.mail_server,
    ok: 'MX records found', fail: 'No mail server found' },
  { key: 'smtp_verified', label: 'SMTP Verification',   pass: c => c.smtp_verified,
    ok: 'Server accepted probe', fail: 'Could not verify' },
  { key: 'mailbox_valid', label: 'Mailbox',              pass: c => c.mailbox_valid,
    ok: 'RCPT accepted', fail: 'Address rejected' },
  { key: 'catch_all',     label: 'Catch-All',           pass: c => !c.catch_all,
    ok: 'Not catch-all', fail: 'Accept-all server' },
  { key: 'temp_email',    label: 'Temporary Email',     pass: c => !c.temp_email,
    ok: 'Legitimate provider', fail: 'Burner / temp address' },
  { key: 'greylisted',    label: 'Greylist Handling',   pass: c => !c.greylisted,
    ok: 'No greylisting', fail: 'Temp rejection (retry)' },
  { key: 'spam_trap',     label: 'Spam Trap',           pass: c => !c.spam_trap,
    ok: 'No trap pattern', fail: 'Spam trap signature' },
  { key: 'role_based',    label: 'Role-Based',          pass: c => !c.role_based,
    ok: 'Personal address', fail: 'Routes to a team inbox' },
  { key: 'gibberish',     label: 'Local Entropy',       pass: c => !c.gibberish,
    ok: 'Normal username', fail: 'Gibberish pattern' },
];

export default function CheckGrid({ checks }) {
  // Support both old and new check key naming for backwards compatibility
  const normalized = {
    dns_syntax:    checks.dns_syntax    ?? checks.syntax    ?? false,
    mail_server:   checks.mail_server   ?? checks.mx        ?? false,
    smtp_verified: checks.smtp_verified ?? checks.smtp      ?? false,
    mailbox_valid: checks.mailbox_valid ?? checks.mailbox   ?? false,
    catch_all:     checks.catch_all     ?? checks.catchAll  ?? false,
    temp_email:    checks.temp_email    ?? checks.disposable ?? false,
    greylisted:    checks.greylisted    ?? false,
    spam_trap:     checks.spam_trap     ?? false,
    role_based:    checks.role_based    ?? checks.roleBased ?? false,
    gibberish:     checks.gibberish     ?? false,
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '16px 0',
    }}>
      {CHECKS.map(({ key, label, pass, ok, fail }) => {
        const passed = pass(normalized);
        const isNeutral = key === 'smtp_verified' || key === 'mailbox_valid';
        const color = passed ? '#22c55e' : isNeutral ? '#f59e0b' : '#ef4444';
        return (
          <div key={key} style={{
            background: '#1a1a26', borderRadius: 8, padding: '10px 14px',
            border: '1px solid #2a2a3e',
          }}>
            <div style={{ fontSize: 10, color: '#8888a8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 13, color, fontFamily: "'DM Mono', monospace" }}>
              {passed ? ok : fail}
            </div>
          </div>
        );
      })}
    </div>
  );
}
