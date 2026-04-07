import React, { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';

const FILTERS = ['all', 'valid', 'risky', 'invalid', 'unknown'];

export default function BulkResultsTable({ results }) {
  const [filter, setFilter] = useState('all');

  const displayed = filter === 'all' ? results : results.filter(r => r.status === filter);

  const scoreColor = (s) => s >= 80 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const count = f === 'all' ? results.length : results.filter(r => r.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12,
                fontFamily: "'Sora', sans-serif", cursor: 'pointer',
                border: filter === f ? '1px solid #6c63ff' : '1px solid #2a2a3e',
                background: filter === f ? 'rgba(108,99,255,0.12)' : '#1a1a26',
                color: filter === f ? '#8b84ff' : '#8888a8',
                transition: 'all .15s',
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{
        border: '1px solid #2a2a3e', borderRadius: 10, overflow: 'hidden',
        maxHeight: 380, overflowY: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#1a1a26', zIndex: 1 }}>
            <tr>
              {['Email', 'Status', 'Score', 'Reason'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '10px 12px',
                  color: '#8888a8', fontWeight: 500, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid #2a2a3e',
                  fontFamily: "'Sora', sans-serif",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(42,42,62,0.5)' }}>
                <td style={{
                  padding: '9px 12px', fontFamily: "'DM Mono', monospace",
                  color: '#e8e8f0', maxWidth: 200, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.email}</td>
                <td style={{ padding: '9px 12px' }}>
                  <StatusBadge status={r.status} />
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 48, height: 4, background: '#3a3a50', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: scoreColor(r.confidence), width: `${r.confidence}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: scoreColor(r.confidence), fontFamily: "'DM Mono', monospace" }}>
                      {r.confidence}%
                    </span>
                  </div>
                </td>
                <td style={{
                  padding: '9px 12px', color: '#8888a8', fontSize: 11,
                  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: "'DM Mono', monospace",
                }}>{r.reason}</td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#8888a8' }}>
                No results for this filter.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
