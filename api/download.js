import fs from 'node:fs';
import path from 'node:path';

// In production the kit zip lives in Redis (uploaded once with
// scripts/upload-kit.mjs), not in the repo or /public — anything committed or
// served statically is free for whoever finds the URL, which would defeat the
// paywall.
const KIT_KEY = 'cockpit:kit';
const MAX_DOWNLOADS = 5;
const COUNTER_TTL_SECONDS = 90 * 24 * 60 * 60;
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

function sendZip(res, zip, remaining) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="Delivery-Cockpit-Kit.zip"');
  res.setHeader('Content-Length', zip.length);
  res.setHeader('Cache-Control', 'no-store');
  if (remaining != null) res.setHeader('X-Downloads-Remaining', String(remaining));
  return res.status(200).send(zip);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  const sessionId = String(req.query.session_id || '');
  if (!SESSION_ID.test(sessionId)) {
    return res.status(400).json({ error: 'missing or invalid session_id' });
  }

  // Ask Stripe rather than trusting the URL: the session id alone proves nothing.
  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (stripeRes.status === 404) {
    return res.status(404).json({ error: 'purchase not found' });
  }
  if (!stripeRes.ok) {
    return res.status(502).json({ error: 'could not verify payment with Stripe' });
  }
  const session = await stripeRes.json();

  if (session.payment_status !== 'paid') {
    return res.status(402).json({ error: 'payment not completed' });
  }
  // If the Stripe account sells anything else, a paid session for another
  // product must not unlock this one.
  const expectedLink = process.env.STRIPE_PAYMENT_LINK_ID;
  if (expectedLink && session.payment_link !== expectedLink) {
    return res.status(403).json({ error: 'this purchase does not include the Delivery Cockpit kit' });
  }

  // Local development only: serve the zip straight from disk (e.g.
  // KIT_LOCAL_PATH="Docs/Dashboard cockpit.zip") so no Redis is needed. Ignored
  // in production, and skips the download limit and stats.
  const localKitPath = process.env.NODE_ENV !== 'production' ? process.env.KIT_LOCAL_PATH : '';
  if (localKitPath) {
    let zip;
    try {
      zip = fs.readFileSync(path.resolve(localKitPath));
    } catch {
      return res.status(503).json({ error: `KIT_LOCAL_PATH file not found: ${localKitPath}` });
    }
    return sendZip(res, zip, null);
  }

  // Imported here, not at the top: redis.js throws at load when the Upstash
  // env vars are missing, which the local path above must not require.
  const { redis, TOTAL_KEY, dailyKey } = await import('./_lib/redis.js');

  const counterKey = `cockpit:dl:${sessionId}`;
  const count = await redis.incr(counterKey);
  if (count > MAX_DOWNLOADS) {
    await redis.decr(counterKey);
    return res.status(429).json({ error: `download limit of ${MAX_DOWNLOADS} reached — contact me for help` });
  }

  const kit = await redis.get(KIT_KEY);
  if (typeof kit !== 'string' || !kit) {
    await redis.decr(counterKey);
    return res.status(503).json({ error: 'kit is not available yet — contact me and I will send it manually' });
  }

  await redis.expire(counterKey, COUNTER_TTL_SECONDS);

  // Count each purchase once (its first download), not every re-download.
  if (count === 1) {
    await Promise.all([
      redis.hincrby(TOTAL_KEY, 'cockpit_download', 1),
      redis.hincrby(dailyKey(), 'cockpit_download', 1),
    ]);
  }

  return sendZip(res, Buffer.from(kit, 'base64'), MAX_DOWNLOADS - count);
}
