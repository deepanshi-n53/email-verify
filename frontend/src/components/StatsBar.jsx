import React from 'react';

const STATS = [
  { num: '2.4M+', label: 'Emails verified' },
  { num: '98.7%', label: 'Accuracy rate' },
  { num: '< 2s',  label: 'Avg response' },
  { num: '100',   label: 'Free checks/day' },
];

export default function StatsBar() {
  return (
    <div style={{
      display: 'flex', gap: 0, justifyContent: 'center',
      borderBottom: '1px solid #2a2a3e', background: '#12121a',
    }}>
      {STATS.map((s, i) => (
        <div key={i} style={{
          textAlign: 'center', padding: '16px 36px',
          borderRight: i < STATS.length - 1 ? '1px solid #2a2a3e' : 'none',
        }}>
          <div style={{
            fontSize: 22, fontWeight: 600, fontFamily: "'DM Mono', monospace",
            background: 'linear-gradient(135deg, #8b84ff, #06b6d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{s.num}</div>
          <div style={{ fontSize: 11, color: '#8888a8', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
