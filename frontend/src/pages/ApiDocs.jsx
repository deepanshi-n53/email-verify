import React, { useState } from 'react';

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <pre style={{
        background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 10,
        padding: 16, fontFamily: "'DM Mono', monospace", fontSize: 12,
        lineHeight: 1.8, overflowX: 'auto', color: '#8888a8', whiteSpace: 'pre',
      }}>{children}</pre>
      <button
        onClick={copy}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: '#2a2a3e', border: 'none', color: copied ? '#22c55e' : '#8888a8',
          padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          fontFamily: "'Sora', sans-serif",
        }}
      >{copied ? 'Copied!' : 'Copy'}</button>
    </div>
  );
}

function Method({ type }) {
  const colors = { GET: { bg: 'rgba(34,197,94,0.12)', c: '#22c55e' }, POST: { bg: 'rgba(245,158,11,0.12)', c: '#f59e0b' } };
  const s = colors[type] || colors.GET;
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 4,
      fontFamily: "'DM Mono', monospace",
      background: s.bg, color: s.c, marginRight: 8,
    }}>{type}</span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#1a1a26', border: '1px solid #2a2a3e',
      borderRadius: 14, padding: 24, marginBottom: 16, ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>;
}

export default function ApiDocs() {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.5px', marginBottom: 8 }}>API Documentation</h2>
        <p style={{ color: '#8888a8', fontSize: 14 }}>
          RESTful JSON API · Free, no account required · All features included
        </p>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 13,
          color: '#06b6d4', background: 'rgba(6,182,212,0.08)',
          padding: '8px 16px', borderRadius: 8, display: 'inline-block', marginTop: 12,
        }}>
          Base URL: https://your-project.vercel.app/api
        </div>
      </div>

      {/* Single verify */}
      <Card>
        <SectionTitle><Method type="GET" />Single Email Verification</SectionTitle>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#06b6d4', background: 'rgba(6,182,212,0.06)', padding: '8px 14px', borderRadius: 8, marginBottom: 12 }}>
          /verify?email=&#123;email&#125;
        </div>
        <p style={{ color: '#8888a8', fontSize: 13, marginBottom: 12 }}>
          Also accepts POST with JSON body <code style={{ background: '#12121a', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{`{"email":"..."}`}</code>
        </p>
        <CodeBlock>{`// GET /api/verify?email=user@example.com
// Response 200 OK

{
  "email": "user@example.com",
  "status": "valid",              // valid | invalid | catch-all | unknown
  "confidence": 85,               // 0–100
  "syntax_valid": "valid",        // Skrapp-compatible: valid | invalid
  "mailbox_status": "valid",      // Skrapp-compatible: valid | invalid | unknown
  "mailbox_type": "professional", // professional | personal | disposable | role
  "email_exchange": "aspmx.l.google.com",
  "verification_method": "smtp_probe", // trusted_provider | smtp_probe | heuristic
  "reason": "Email is valid and successfully reachable.",
  "checks": {
    "dns_syntax":    true,   // RFC 5321/5322 compliant
    "mail_server":   true,   // MX records found
    "smtp_verified": true,   // SMTP server accepted probe
    "catch_all":     false,  // Not a catch-all domain
    "temp_email":    false,  // Not a disposable provider
    "greylisted":    false,  // No temporary rejection
    "spam_trap":     false,  // No spam trap pattern
    "role_based":    false,  // Not a role address
    "spf":           true    // SPF record present
  },
  "mx_records": ["aspmx.l.google.com"],
  "response_time_ms": 312
}`}</CodeBlock>
      </Card>

      {/* Bulk verify */}
      <Card>
        <SectionTitle><Method type="POST" />Bulk Verification</SectionTitle>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#06b6d4', background: 'rgba(6,182,212,0.06)', padding: '8px 14px', borderRadius: 8, marginBottom: 12 }}>
          /bulk-verify
        </div>
        <CodeBlock>{`// Request
POST /api/bulk-verify
Content-Type: application/json

{
  "emails": ["a@gmail.com", "b@yahoo.com", "c@mailinator.com"],
  "options": {
    "filter": "all"   // "all" | "valid" | "risky_or_valid"
  }
}

// Response 200 OK
{
  "total_submitted": 3,
  "total_unique": 3,
  "total_processed": 3,
  "processing_time_ms": 3821,
  "stats": {
    "valid": 2,
    "invalid": 0,
    "risky": 1,
    "unknown": 0
  },
  "results": [
    { "email": "a@gmail.com",      "status": "valid",  "confidence": 90, ... },
    { "email": "b@yahoo.com",      "status": "valid",  "confidence": 88, ... },
    { "email": "c@mailinator.com", "status": "risky",  "confidence": 10, ... }
  ]
}`}</CodeBlock>
      </Card>

      {/* Health */}
      <Card>
        <SectionTitle><Method type="GET" />Health Check</SectionTitle>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#06b6d4', background: 'rgba(6,182,212,0.06)', padding: '8px 14px', borderRadius: 8, marginBottom: 12 }}>
          /health
        </div>
        <CodeBlock>{`// Response 200 OK
{
  "status": "ok",
  "version": "1.0.0",
  "service": "MailProbe API",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime_seconds": 86400,
  "features": {
    "single_verify": true,
    "bulk_verify":   true,
    "smtp_worker":   false,    // true when SMTP_WORKER_URL is set
    "kv_cache":      false     // true when Vercel KV is configured
  }
}`}</CodeBlock>
      </Card>

      {/* Status codes */}
      <Card>
        <SectionTitle>Status codes & error responses</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
          {[
            ['200', 'Success'],
            ['400', 'Bad request — missing or malformed email'],
            ['405', 'Method not allowed'],
            ['429', 'Rate limit exceeded (100/day free)'],
            ['500', 'Internal verification error — retry'],
          ].map(([code, desc]) => (
            <React.Fragment key={code}>
              <span style={{ fontFamily: "'DM Mono', monospace", color: code.startsWith('2') ? '#22c55e' : code.startsWith('4') ? '#f59e0b' : '#ef4444' }}>{code}</span>
              <span style={{ color: '#8888a8' }}>{desc}</span>
            </React.Fragment>
          ))}
        </div>
        <CodeBlock>{`// 429 Rate limit response
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. 100 verifications/day per IP.",
  "limit": 100,
  "remaining": 0,
  "reset_in_seconds": 43200
}`}</CodeBlock>
      </Card>

      {/* Code examples */}
      <Card>
        <SectionTitle>Code examples</SectionTitle>
        <p style={{ color: '#8888a8', fontSize: 13, marginBottom: 12 }}>JavaScript (fetch)</p>
        <CodeBlock>{`const res = await fetch('/api/verify?email=user@example.com');
const data = await res.json();

if (data.status === 'valid' && data.confidence >= 75) {
  console.log('Safe to send:', data.email);
} else {
  console.log('Skip:', data.reason);
}`}</CodeBlock>
        <p style={{ color: '#8888a8', fontSize: 13, marginBottom: 12 }}>Python (requests)</p>
        <CodeBlock>{`import requests

r = requests.get(
    'https://your-project.vercel.app/api/verify',
    params={'email': 'user@example.com'}
)
data = r.json()
print(data['status'], data['confidence'])`}</CodeBlock>
        <p style={{ color: '#8888a8', fontSize: 13, marginBottom: 12 }}>cURL</p>
        <CodeBlock>{`curl "https://your-project.vercel.app/api/verify?email=test@gmail.com"

# Bulk
curl -X POST "https://your-project.vercel.app/api/bulk-verify" \\
  -H "Content-Type: application/json" \\
  -d '{"emails":["a@gmail.com","b@yahoo.com"]}'`}</CodeBlock>
      </Card>

      {/* Rate limits */}
      <Card>
        <SectionTitle>Free Tier Limits</SectionTitle>
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          {[
            ['Single verify', '100/day per IP (no account needed)'],
            ['Bulk verify', '500 emails/job, 12 jobs/hour per IP'],
            ['API key required', 'No — all features included'],
            ['Paid tier', 'None — everything is free'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#12121a', borderRadius: 8, border: '1px solid #2a2a3e' }}>
              <span style={{ color: '#8888a8' }}>{label}</span>
              <span style={{ color: '#e8e8f0', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{value}</span>
            </div>
          ))}
        </div>
        <p style={{ color: '#8888a8', fontSize: 12, marginTop: 12 }}>
          Rate limit headers: <code style={{ background: '#12121a', padding: '1px 6px', borderRadius: 4 }}>X-RateLimit-Limit</code>{' '}
          <code style={{ background: '#12121a', padding: '1px 6px', borderRadius: 4 }}>X-RateLimit-Remaining</code>{' '}
          <code style={{ background: '#12121a', padding: '1px 6px', borderRadius: 4 }}>X-RateLimit-Reset</code>
        </p>
      </Card>
    </div>
  );
}
