import React, { useState, useRef } from 'react';
import VerificationSteps from '../components/VerificationSteps.jsx';
import ResultCard        from '../components/ResultCard.jsx';
import { verifySingle }  from '../lib/api.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Simulate step-by-step UI progress while real API call runs in parallel
const STEP_SEQUENCE = [
  { id: 'syntax',     delay: 200 },
  { id: 'mx',         delay: 500 },
  { id: 'disposable', delay: 300 },
  { id: 'role',       delay: 200 },
  { id: 'smtp',       delay: 600 },
  { id: 'catchall',   delay: 400 },
  { id: 'gibberish',  delay: 250 },
];

export default function SingleVerify() {
  const [email,      setEmail]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [stepStates, setStepStates] = useState({});
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState('');
  const inputRef = useRef(null);

  async function runVerify() {
    const trimmed = email.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setResult(null);
    setError('');
    setStepStates({});

    // Start API call + animated steps in parallel
    const apiCall = verifySingle(trimmed);

    // Animate steps
    for (const step of STEP_SEQUENCE) {
      setStepStates(prev => ({ ...prev, [step.id]: 'running' }));
      await sleep(step.delay);
      setStepStates(prev => ({ ...prev, [step.id]: 'done' })); // optimistic; corrected after API
    }

    try {
      const data = await apiCall;

      // Update steps to match actual result
      setStepStates({
        syntax:    data.checks.syntax     ? 'done' : 'fail',
        mx:        data.checks.mx         ? 'done' : 'fail',
        disposable: !data.checks.disposable ? 'done' : 'fail',
        role:      !data.checks.roleBased  ? 'done' : 'fail',
        smtp:      data.checks.smtp       ? 'done' : 'fail',
        catchall:  !data.checks.catchAll  ? 'done' : 'fail',
        gibberish: !data.checks.gibberish ? 'done' : 'fail',
      });

      setResult(data);
    } catch (err) {
      setError(err.data?.message || err.message || 'Verification failed. Please try again.');
      setStepStates(prev => {
        // Mark last running step as failed
        const updated = { ...prev };
        const lastRunning = Object.entries(updated).reverse().find(([, v]) => v === 'running');
        if (lastRunning) updated[lastRunning[0]] = 'fail';
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  const hasSteps = Object.keys(stepStates).length > 0;

  return (
    <div style={{ maxWidth: 660, margin: '48px auto 0' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)',
          borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#8b84ff',
          marginBottom: 18,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6c63ff', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          7-layer verification engine
        </div>
        <h1 style={{
          fontSize: 38, fontWeight: 600, letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 12,
        }}>
          Verify emails with{' '}
          <span style={{
            background: 'linear-gradient(135deg, #8b84ff, #06b6d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>surgical precision</span>
        </h1>
        <p style={{ color: '#8888a8', fontSize: 15, fontWeight: 300, maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
          SMTP handshake · catch-all detection · disposable filtering · confidence scoring.
          Zero false positives.
        </p>
      </div>

      {/* Input card */}
      <div style={{
        background: '#1a1a26', border: '1px solid #2a2a3e',
        borderRadius: 16, padding: 28,
      }}>
        {/* Input row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: hasSteps ? 20 : 0 }}>
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runVerify()}
            placeholder="Enter email address to verify..."
            disabled={loading}
            style={{
              flex: 1, background: '#12121a', border: '1px solid #2a2a3e',
              color: '#e8e8f0', fontFamily: "'DM Mono', monospace", fontSize: 14,
              padding: '12px 16px', borderRadius: 10, outline: 'none',
              transition: 'border-color .2s',
            }}
            onFocus={e => e.target.style.borderColor = '#6c63ff'}
            onBlur={e  => e.target.style.borderColor = '#2a2a3e'}
          />
          <button
            onClick={runVerify}
            disabled={loading || !email.trim()}
            style={{
              background: loading ? '#3a3a50' : '#6c63ff',
              color: '#fff', border: 'none',
              padding: '12px 24px', borderRadius: 10,
              fontSize: 14, fontFamily: "'Sora', sans-serif", fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', transition: 'all .2s', minWidth: 100,
            }}
          >
            {loading ? '...' : 'Verify →'}
          </button>
        </div>

        {/* Animated steps */}
        {hasSteps && <VerificationSteps stepStates={stepStates} />}

        {/* Result */}
        {result && <ResultCard result={result} />}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '12px 16px', color: '#ef4444', fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Quick tips */}
      <div style={{
        marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {['john@gmail.com', 'noreply@company.com', 'test@mailinator.com', 'xkqz88@hotmail.com'].map(ex => (
          <button
            key={ex}
            onClick={() => { setEmail(ex); setTimeout(runVerify, 50); }}
            style={{
              background: 'transparent', border: '1px solid #2a2a3e',
              color: '#8888a8', padding: '5px 12px', borderRadius: 8,
              fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
              transition: 'all .15s',
            }}
            onMouseOver={e => { e.target.style.borderColor = '#6c63ff'; e.target.style.color = '#8b84ff'; }}
            onMouseOut={e  => { e.target.style.borderColor = '#2a2a3e'; e.target.style.color = '#8888a8'; }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
