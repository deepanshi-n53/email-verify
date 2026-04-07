# SMTP Worker (Railway Microservice)

Vercel serverless functions cannot open raw TCP on port 25.
Deploy this tiny Express app on Railway to enable real RCPT probing.

## server.js (deploy to Railway)

```js
const express = require('express');
const net     = require('net');
const app     = express();
app.use(express.json());

const SECRET = process.env.PROBE_SECRET || '';

app.post('/probe', async (req, res) => {
  if (req.headers['x-secret'] !== SECRET) return res.status(401).json({ error: 'unauthorized' });
  const { domain, mx, email } = req.body;
  const host = mx || domain;
  try {
    const result = await smtpProbe(host, email || `probe-${Date.now()}@${domain}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function smtpProbe(host, email) {
  return new Promise((resolve) => {
    const sock = net.createConnection(25, host);
    let buf = '', stage = 0;
    const done = (r) => { sock.destroy(); resolve(r); };
    const timeout = setTimeout(() => done({ connected: false, error: 'timeout' }), 8000);

    sock.on('connect', () => {});
    sock.on('data', (d) => {
      buf += d.toString();
      if (stage === 0 && buf.includes('220')) {
        stage = 1; sock.write('EHLO verifier.mailprobe.io\r\n');
      } else if (stage === 1 && buf.includes('250')) {
        stage = 2; sock.write('MAIL FROM:<probe@mailprobe.io>\r\n');
      } else if (stage === 2 && buf.includes('250')) {
        stage = 3; sock.write(`RCPT TO:<${email}>\r\n`);
      } else if (stage === 3) {
        clearTimeout(timeout);
        const code = parseInt(buf.slice(-4));
        const accepted = code === 250 || code === 251;
        sock.write('QUIT\r\n');
        done({ connected: true, mailbox: accepted, code });
      }
    });
    sock.on('error', (e) => { clearTimeout(timeout); done({ connected: false, error: e.message }); });
  });
}

app.listen(process.env.PORT || 3001, () => console.log('SMTP worker running'));
```

## Deploy on Railway

```bash
railway init
railway up
# Set env: PROBE_SECRET=your-shared-secret
# Copy the URL to SMTP_WORKER_URL in Vercel env vars
```
