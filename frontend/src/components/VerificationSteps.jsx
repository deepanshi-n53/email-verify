import React from 'react';

const STEPS = [
  { id: 'syntax',     label: 'Syntax validation (RFC 5321/5322)' },
  { id: 'mx',         label: 'Domain MX record lookup' },
  { id: 'disposable', label: 'Disposable domain check' },
  { id: 'role',       label: 'Role-based address detection' },
  { id: 'smtp',       label: 'SMTP connection handshake' },
  { id: 'catchall',   label: 'Catch-all domain probe' },
  { id: 'gibberish',  label: 'Local-part entropy analysis' },
];

function StepIcon({ state }) {
  const base = {
    width: 18, height: 18, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0,
  };
  if (state === 'pending') return <div style={{ ...base, background: '#3a3a50' }} />;
  if (state === 'running') return (
    <div style={{ ...base, border: '1.5px solid #6c63ff', background: 'rgba(108,99,255,0.1)' }}>
      <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', color: '#6c63ff' }}>◌</span>
    </div>
  );
  if (state === 'done') return (
    <div style={{ ...base, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✓</div>
  );
  if (state === 'fail') return (
    <div style={{ ...base, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>✕</div>
  );
  return null;
}

export default function VerificationSteps({ stepStates }) {
  // stepStates: { syntax: 'done'|'running'|'fail'|'pending', ... }
  const colorMap = { running: '#8b84ff', done: '#22c55e', fail: '#ef4444', pending: '#8888a8' };

  return (
    <div style={{ marginBottom: 16 }}>
      {STEPS.map(step => {
        const state = stepStates[step.id] || 'pending';
        return (
          <div key={step.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 10px', borderRadius: 8, marginBottom: 4,
            background: state === 'running' ? 'rgba(108,99,255,0.05)' : 'transparent',
            transition: 'background 0.2s',
          }}>
            <StepIcon state={state} />
            <span style={{
              fontSize: 12, fontFamily: "'DM Mono', monospace",
              color: colorMap[state] || '#8888a8',
              transition: 'color 0.2s',
            }}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { STEPS };
