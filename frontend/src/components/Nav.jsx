import React from 'react';

const s = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 32px', borderBottom: '1px solid #2a2a3e',
    background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(12px)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  logo: {
    fontSize: 17, fontWeight: 600, letterSpacing: '-0.5px',
    display: 'flex', alignItems: 'center', gap: 8, color: '#e8e8f0',
    fontFamily: "'Sora', sans-serif",
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%', background: '#6c63ff',
    boxShadow: '0 0 10px #6c63ff', animation: 'pulse 2s infinite',
  },
  links: { display: 'flex', gap: 8, alignItems: 'center' },
};

const TABS = [
  { id: 'single', label: 'Single Verify' },
  { id: 'bulk',   label: 'Bulk Verify' },
  { id: 'api',    label: 'API Docs' },
];

export default function Nav({ activeTab, onTabChange }) {
  return (
    <nav style={s.nav}>
      <div style={s.logo}>
        <div style={s.dot} />
        MailProbe
      </div>

      <div style={s.links}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            style={{
              background: activeTab === t.id ? '#1a1a26' : 'transparent',
              border: activeTab === t.id ? '1px solid #3a3a54' : '1px solid transparent',
              color: activeTab === t.id ? '#e8e8f0' : '#8888a8',
              padding: '7px 16px', borderRadius: 8,
              fontSize: 13, fontFamily: "'Sora', sans-serif", fontWeight: 500,
              cursor: 'pointer', transition: 'all .2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#8888a8', fontFamily: "'DM Mono', monospace" }}>
        Free · No account required
      </div>
    </nav>
  );
}
