import React from 'react';
import StatusBadge from './StatusBadge.jsx';
import CheckGrid   from './CheckGrid.jsx';

const METHOD_LABELS = {
  trusted_provider: '✓ Trusted provider (MX verified)',
  smtp_probe:       '✓ Full SMTP probe',
  heuristic:        '⚡ Heuristic (deploy SMTP worker for full accuracy)',
  none:             '—',
};

export default function ResultCard({ result }) {
  if (!result) return null;
  const {
    email, status, confidence, reason, mx_records, checks,
    response_time_ms, verification_method,
    mx_host, email_exchange, mailbox_type,
  } = result;

  const scoreColor = confidence >= 80 ? '#22c55e' : confidence >= 50 ? '#f59e0b' : '#ef4444';
  const mxDisplay  = mx_host || email_exchange || mx_records?.[0] || null;
  const method     = verification_method || 'none';

  return (
    <div className="fade-up" style={{
      background: '#12121a', border: '1px solid #2a2a3e',
      borderRadius: 12, padding: 20, marginTop: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{
            fontSize: 13, color: '#8888a8', marginBottom: 6,
            fontFamily: "'DM Mono', monospace",
          }}>{email}</div>
          <StatusBadge status={status} size="lg" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#8888a8', marginBottom: 4 }}>Confidence</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'DM Mono', monospace", color: scoreColor }}>
            {confidence}%
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ height: 4, background: '#3a3a50', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2, background: scoreColor,
          width: `${confidence}%`, transition: 'width 0.8s ease',
        }} />
      </div>

      {/* Check grid */}
      <CheckGrid checks={checks} />

      {/* Reason */}
      <div style={{
        fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 12,
        background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)',
        color: '#8b84ff',
      }}>{reason}</div>

      {/* Meta rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 12, borderTop: '1px solid #2a2a3e' }}>
        {mxDisplay && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#8888a8' }}>Email Exchange (MX)</span>
            <span style={{ color: '#e8e8f0', fontFamily: "'DM Mono', monospace" }}>{mxDisplay}</span>
          </div>
        )}
        {mailbox_type && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#8888a8' }}>Mailbox Type</span>
            <span style={{ color: '#e8e8f0', fontFamily: "'DM Mono', monospace", textTransform: 'capitalize' }}>{mailbox_type}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#8888a8' }}>Verification Method</span>
          <span style={{ color: method === 'heuristic' ? '#f59e0b' : '#8888a8', fontFamily: "'DM Mono', monospace" }}>
            {METHOD_LABELS[method] || method}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#8888a8' }}>Response Time</span>
          <span style={{ color: '#8888a8', fontFamily: "'DM Mono', monospace" }}>{response_time_ms}ms</span>
        </div>
      </div>
    </div>
  );
}
