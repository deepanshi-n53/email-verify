import React, { useState, useRef, useCallback } from 'react';
import BulkResultsTable from '../components/BulkResultsTable.jsx';
import { verifyBulk }   from '../lib/api.js';
import { parseUploadedFile, exportCSV, exportXLSX } from '../lib/export.js';

const DEMO_EMAILS = [
  'alice@gmail.com','bob@yahoo.com','support@company.com',
  'noreply@mailinator.com','john.smith@outlook.com','xkqz8m@tempmail.com',
  'ceo@fortune500.com','admin@example.com','jane.doe@icloud.com',
  'asdf8823zz@hotmail.com','marketing@startup.io','invalid-email@',
  'info@catch-all-test.com','user123@protonmail.com',
  'no-reply@shopify.com','real.person@fastmail.com',
  'qwertyuiop@gmail.com','contact@b2bcompany.com',
  'fake@@test','test@yopmail.com',
];

export default function BulkVerify() {
  const [dragging,  setDragging]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState(null);   // { done, total, stats }
  const [results,   setResults]   = useState(null);
  const [error,     setError]     = useState('');
  const fileRef = useRef(null);

  const runBulk = useCallback(async (emails) => {
    if (!emails.length) return;
    setLoading(true);
    setResults(null);
    setError('');
    setProgress({ done: 0, total: emails.length, stats: { valid:0,invalid:0,'catch-all':0,unknown:0 } });

    // Vercel function handles the async processing;
    // we poll every 300ms to update the progress bar (simulated client-side).
    // For real-time: use EventSource / SSE from the API.
    const BATCH = 20; // process in visible batches for UI feedback
    let allResults = [];

    for (let i = 0; i < emails.length; i += BATCH) {
      const chunk = emails.slice(i, i + BATCH);
      try {
        const data = await verifyBulk(chunk);
        allResults = allResults.concat(data.results || []);
        const stats = allResults.reduce((acc, r) => { acc[r.status]=(acc[r.status]||0)+1; return acc; },
          { valid:0, invalid:0, 'catch-all':0, unknown:0 });
        setProgress({ done: allResults.length, total: emails.length, stats });
      } catch (err) {
        setError(err.data?.message || err.message || 'Verification failed.');
        break;
      }
    }

    setResults(allResults);
    setLoading(false);
  }, []);

  const handleFile = useCallback(async (file) => {
    try {
      const emails = await parseUploadedFile(file);
      if (emails.length === 0) { setError('No valid email addresses found in file.'); return; }
      if (emails.length > 500) { setError(`File contains ${emails.length} emails. Max 500 emails per batch.`); return; }
      await runBulk(emails);
    } catch (err) {
      setError(err.message);
    }
  }, [runBulk]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const MiniStat = ({ num, label, color }) => (
    <div style={{ background: '#12121a', borderRadius: 8, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'DM Mono', monospace", color }}>{num}</div>
      <div style={{ fontSize: 10, color: '#8888a8', marginTop: 2 }}>{label}</div>
    </div>
  );

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ maxWidth: 720, margin: '40px auto 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.5px', marginBottom: 8 }}>
          Bulk Email Verification
        </h2>
        <p style={{ color: '#8888a8', fontSize: 14 }}>
          Upload CSV or XLSX · up to 500 emails free · export results instantly
        </p>
      </div>

      <div style={{ background: '#1a1a26', border: '1px solid #2a2a3e', borderRadius: 16, padding: 28 }}>

        {/* Drop zone */}
        {!loading && !results && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? '#6c63ff' : '#3a3a54'}`,
              borderRadius: 14, padding: '48px 32px', textAlign: 'center',
              background: dragging ? 'rgba(108,99,255,0.04)' : 'transparent',
              cursor: 'pointer', transition: 'all .2s', marginBottom: 16,
            }}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt"
              style={{ display: 'none' }}
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
            />
            <div style={{
              width: 48, height: 48, margin: '0 auto 16px',
              background: '#12121a', borderRadius: 12, border: '1px solid #2a2a3e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" fill="none" stroke="#8888a8" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
              Drop CSV or XLSX here, or click to browse
            </div>
            <div style={{ fontSize: 13, color: '#8888a8' }}>
              One email per row · comma/semicolon separated · max 500 free
            </div>
          </div>
        )}

        {/* Demo button */}
        {!loading && !results && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ color: '#8888a8', fontSize: 13, marginRight: 10 }}>or</span>
            <button
              onClick={() => runBulk(DEMO_EMAILS)}
              style={{
                background: 'transparent', border: '1px solid #3a3a54', color: '#8888a8',
                padding: '8px 20px', borderRadius: 8, fontSize: 13,
                fontFamily: "'Sora', sans-serif", cursor: 'pointer', transition: 'all .2s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor='#6c63ff'; e.currentTarget.style.color='#8b84ff'; }}
              onMouseOut={e  => { e.currentTarget.style.borderColor='#3a3a54'; e.currentTarget.style.color='#8888a8'; }}
            >
              ▶ Run Demo (20 emails)
            </button>
          </div>
        )}

        {/* Progress */}
        {(loading || (progress && !results)) && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {loading ? 'Verifying emails...' : 'Complete'}
              </span>
              <span style={{ fontSize: 12, color: '#8888a8', fontFamily: "'DM Mono', monospace" }}>
                {progress?.done} / {progress?.total}
              </span>
            </div>
            <div style={{ height: 6, background: '#3a3a50', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{
                height: '100%', borderRadius: 3, transition: 'width .3s',
                background: 'linear-gradient(90deg, #6c63ff, #06b6d4)',
                width: `${pct}%`,
              }} />
            </div>
            {progress?.stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                <MiniStat num={progress.stats.valid}          label="Valid"      color="#22c55e" />
                <MiniStat num={progress.stats.invalid}        label="Invalid"    color="#ef4444" />
                <MiniStat num={progress.stats['catch-all']}   label="Catch-All"  color="#f59e0b" />
                <MiniStat num={progress.stats.unknown}        label="Unknown"    color="#8888a8" />
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="fade-up">
            {/* Heuristic accuracy warning */}
            {results.some(r => r.verification_method === 'heuristic') && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 10, padding: '10px 14px', color: '#f59e0b', fontSize: 12,
                marginBottom: 14, lineHeight: 1.6,
              }}>
                ⚡ Results based on DNS/MX heuristic. For full SMTP accuracy (catch-all + invalid detection),
                set <code style={{ background: 'rgba(245,158,11,0.1)', padding: '1px 5px', borderRadius: 3 }}>SMTP_WORKER_URL</code> in your Vercel environment variables.
              </div>
            )}

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { k: 'valid',     c: '#22c55e', l: 'Valid' },
                { k: 'invalid',   c: '#ef4444', l: 'Invalid' },
                { k: 'catch-all', c: '#f59e0b', l: 'Catch-All' },
                { k: 'unknown',   c: '#8888a8', l: 'Unknown' },
              ].map(({ k, c, l }) => (
                <MiniStat key={k} num={results.filter(r=>r.status===k).length} label={l} color={c} />
              ))}
            </div>

            {/* Export buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={() => exportCSV(results.filter(r=>r.status==='valid'), 'mailprobe-valid.csv')}
                style={btnStyle(false)}>Export Valid Only CSV</button>
              <button onClick={() => exportCSV(results, 'mailprobe-all.csv')}
                style={btnStyle(false)}>Export All CSV</button>
              <button onClick={() => exportXLSX(results, 'mailprobe-results.xlsx')}
                style={btnStyle(true)}>Export XLSX</button>
              <button onClick={() => { setResults(null); setProgress(null); setError(''); }}
                style={{ ...btnStyle(false), marginLeft: 'auto' }}>↩ New Upload</button>
            </div>

            <BulkResultsTable results={results} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '12px 16px', color: '#ef4444', fontSize: 13, marginTop: 12,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(primary) {
  return {
    padding: '7px 16px', borderRadius: 8, fontSize: 12,
    fontFamily: "'Sora', sans-serif", fontWeight: 500, cursor: 'pointer', transition: 'all .2s',
    border: primary ? '1px solid #6c63ff' : '1px solid #2a2a3e',
    background: primary ? '#6c63ff' : '#12121a',
    color: primary ? '#fff' : '#e8e8f0',
  };
}
