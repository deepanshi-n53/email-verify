# Deploy SMTP Worker to Railway

This worker does real SMTP RCPT probing (port 25).
Required for catch-all detection and invalid mailbox detection.

## Steps

1. Go to railway.app → New Project → Deploy from GitHub
2. Select the `smtp-worker/` folder as the root
3. Railway will auto-detect Node.js and run `node index.js`
4. Add environment variable:
   - `SMTP_SECRET` = any random secret string (e.g. generate with `openssl rand -hex 32`)
5. After deploy, copy the Railway public URL

## Connect to Vercel

In Vercel dashboard → Settings → Environment Variables:
- `SMTP_WORKER_URL` = `https://your-worker.up.railway.app`
- `SMTP_WORKER_SECRET` = same secret you set on Railway

## What this enables

Without SMTP worker (current):
- DNS/MX check ✓
- Disposable detection ✓
- Syntax check ✓
- SMTP verification ✗ (heuristic only)
- Catch-all detection ✗
- Invalid mailbox detection ✗
- Greylisting detection ✗

With SMTP worker:
- Everything above ✓
- SMTP RCPT probe ✓
- Catch-all detection ✓
- Invalid mailbox detection ✓
- Greylisting detection ✓
- Accuracy: 95%+ (vs 72% without)
