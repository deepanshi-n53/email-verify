// smtp-worker/index.js
const net = require('net');
const crypto = require('crypto');
const express = require('express');
const app = express();
app.use(express.json());

const SECRET = process.env.SMTP_SECRET || 'changeme';
const PORT = process.env.PORT || 3001;

// Auth middleware
app.use((req, res, next) => {
  if (req.headers['x-secret'] !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

/**
 * SMTP probe: connects to MX server, sends EHLO + MAIL FROM + RCPT TO
 * Returns: { connected, accepted, catchAll, greylisted, error }
 */
async function smtpProbe(mxHost, email, fromDomain = 'verify.mailprobe.io') {
  return new Promise((resolve) => {
    const timeout = 10000;
    let resolved = false;
    let stage = 'connect';
    const log = [];

    const done = (result) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ ...result, log });
      }
    };

    const socket = net.createConnection(25, mxHost);
    socket.setTimeout(timeout);

    socket.on('timeout', () => done({ connected: false, error: 'timeout' }));
    socket.on('error', (err) => done({ connected: false, error: err.message }));

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line) continue;
        log.push(line);
        const code = parseInt(line.slice(0, 3));

        if (stage === 'connect' && code === 220) {
          stage = 'ehlo';
          socket.write(`EHLO ${fromDomain}\r\n`);
        } else if (stage === 'ehlo' && (code === 250 || code === 220)) {
          if (line.startsWith('250 ') || line.startsWith('250-')) {
            // wait for full EHLO response
            if (!line.includes('-')) {
              stage = 'mail_from';
              socket.write(`MAIL FROM:<probe@${fromDomain}>\r\n`);
            }
          }
        } else if (stage === 'mail_from' && code === 250) {
          stage = 'rcpt_real';
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (stage === 'rcpt_real') {
          const [, domain] = email.split('@');
          const fakeEmail = `${crypto.randomUUID()}@${domain}`;

          if (code === 250) {
            // Real address accepted — now probe catch-all
            stage = 'rcpt_fake';
            socket.write(`RCPT TO:<${fakeEmail}>\r\n`);
          } else if (code >= 400 && code < 500) {
            // Greylisted (temporary rejection)
            done({ connected: true, accepted: false, greylisted: true });
          } else if (code >= 500) {
            // Permanent rejection — mailbox does not exist
            done({ connected: true, accepted: false, greylisted: false });
          }
        } else if (stage === 'rcpt_fake') {
          if (code === 250) {
            // Fake address also accepted = catch-all
            done({ connected: true, accepted: true, catchAll: true, greylisted: false });
          } else {
            // Fake rejected, real accepted = verified mailbox
            done({ connected: true, accepted: true, catchAll: false, greylisted: false });
          }
          socket.write('QUIT\r\n');
        }

        // Handle connection-level rejections
        if (code === 421 || code === 554) {
          done({ connected: false, error: `server_rejected_${code}` });
        }
      }
    });

    socket.on('connect', () => {
      // banner will come via data event
    });
  });
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// SMTP probe endpoint
app.post('/probe', async (req, res) => {
  const { email, mx } = req.body;
  if (!email || !mx) {
    return res.status(400).json({ error: 'email and mx required' });
  }

  try {
    const result = await smtpProbe(mx, email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// Batch probe endpoint (for bulk verify)
app.post('/probe-batch', async (req, res) => {
  const { emails } = req.body; // [{ email, mx }]
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'emails array required' });
  }

  const results = await Promise.all(
    emails.map(({ email, mx }) =>
      smtpProbe(mx, email).catch(err => ({ connected: false, error: err.message }))
    )
  );
  res.json({ results });
});

app.listen(PORT, () => console.log(`SMTP worker on port ${PORT}`));
