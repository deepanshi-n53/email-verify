import React, { useState } from 'react';
import Nav         from './components/Nav.jsx';
import StatsBar    from './components/StatsBar.jsx';
import SingleVerify from './pages/SingleVerify.jsx';
import BulkVerify   from './pages/BulkVerify.jsx';
import ApiDocs      from './pages/ApiDocs.jsx';

export default function App() {
  const [tab, setTab] = useState('single');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav activeTab={tab} onTabChange={setTab} />
      <StatsBar />

      <main style={{ flex: 1, padding: '0 16px 64px' }}>
        {tab === 'single' && <SingleVerify />}
        {tab === 'bulk'   && <BulkVerify />}
        {tab === 'api'    && <ApiDocs />}
      </main>
    </div>
  );
}
