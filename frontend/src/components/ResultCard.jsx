import React from 'react';
import StatusBadge from './StatusBadge.jsx';
import CheckGrid   from './CheckGrid.jsx';

export default function ResultCard({ result }) {
  if (!result) return null;
  const { email, status, confidence, reason, mx_records, checks, response_time_ms } = result;

  const scoreColor = confidence >= 80 ? '#22c55e' : confidence >= 50 ? '#f59e0b' : '#ef4444';

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

      {/* 8-check grid */}
      <CheckGrid checks={checks} />

      {/* Reason + meta */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        paddingTop: 12, borderTop: '1px solid #2a2a3e',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 12, padding: '4px 12px', borderRadius: 20,
          background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)',
          color: '#8b84ff',
        }}>{reason}</span>

        <span style={{ fontSize: 11, color: '#8888a8', fontFamily: "'DM Mono', monospace" }}>
          {mx_records?.[0] && `MX: ${mx_records[0]} · `}{response_time_ms}ms
        </span>
      </div>
    </div>
  );
}
