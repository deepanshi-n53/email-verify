import React from 'react';

const CHECKS = [
  { key: 'syntax',    label: 'Syntax',        pass: c => c.syntax,
    ok: 'RFC 5321/5322 compliant', fail: 'Invalid format' },
  { key: 'mx',       label: 'MX Records',     pass: c => c.mx,
    ok: 'Found — domain accepts mail', fail: 'No MX records found' },
  { key: 'smtp',     label: 'SMTP Connect',   pass: c => c.smtp,
    ok: 'Server responded', fail: 'Timed out or blocked' },
  { key: 'mailbox',  label: 'Mailbox',        pass: c => c.mailbox,
    ok: 'RCPT accepted', fail: 'Address rejected' },
  { key: 'catchAll', label: 'Catch-all',      pass: c => !c.catchAll,
    ok: 'Not catch-all', fail: 'Accept-all server' },
  { key: 'disposable',label:'Disposable',     pass: c => !c.disposable,
    ok: 'Legitimate provider', fail: 'Burner / temp address' },
  { key: 'roleBased',label: 'Role-based',     pass: c => !c.roleBased,
    ok: 'Personal address', fail: 'Routes to a team inbox' },
  { key: 'gibberish',label: 'Local entropy',  pass: c => !c.gibberish,
    ok: 'Normal username', fail: 'Gibberish pattern detected' },
];

export default function CheckGrid({ checks }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '16px 0',
    }}>
      {CHECKS.map(({ key, label, pass, ok, fail }) => {
        const passed = pass(checks);
        const color  = passed ? '#22c55e' : (key === 'smtp' ? '#f59e0b' : '#ef4444');
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
