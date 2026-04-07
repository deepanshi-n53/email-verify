import React from 'react';

const CONFIG = {
  valid:   { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e', border: 'rgba(34,197,94,0.3)',  icon: '✓', label: 'Valid' },
  invalid: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)', icon: '✕', label: 'Invalid' },
  risky:   { bg: 'rgba(245,158,11,0.12)',color: '#f59e0b', border: 'rgba(245,158,11,0.3)',icon: '⚠', label: 'Risky' },
  unknown: { bg: 'rgba(136,136,168,0.1)','color': '#8888a8', border: '#2a2a3e',            icon: '?', label: 'Unknown' },
};

export default function StatusBadge({ status, size = 'md' }) {
  const c = CONFIG[status] || CONFIG.unknown;
  const fontSize = size === 'lg' ? 14 : 12;
  const padding  = size === 'lg' ? '6px 14px' : '3px 10px';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding, borderRadius: 20, fontSize, fontWeight: 500,
      fontFamily: "'Sora', sans-serif",
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      {c.icon} {c.label}
    </span>
  );
}
