import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { razorpayFetch, PRODUCT_TAG } from './_lib/razorpay.js';

// In production the kit zip lives in Redis (uploaded once with
// scripts/upload-kit.mjs), not in the repo or /public — anything committed or
// served statically is free for whoever finds the URL, which would defeat the
// paywall.
const KIT_KEY = 'cockpit:kit';
const MAX_DOWNLOADS = 5;
const COUNTER_TTL_SECONDS = 90 * 24 * 60 * 60;

const ORDER_ID = /^order_[A-Za-z0-9]{8,40}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{8,40}$/;
const SIGNATURE = /^[a-f0-9]{64}$/;

function sendZip(res, zip, remaining) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="Delivery-Cockpit-Kit.zip"');
  res.setHeader('Content-Length', zip.length);
  res.setHeader('Cache-Control', 'no-store');
  if (remaining != null) res.setHeader('X-Downloads-Remaining', String(remaining));
  return res.status(200).send(zip);
}

// POST { orderId, paymentId, signature } — the three values Razorpay Checkout
// hands the browser after a successful payment.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !process.env.RAZORPAY_KEY_ID) {
    return res.status(500).json({ error: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const { orderId, paymentId, signature } = body || {};
  if (!ORDER_ID.test(orderId) || !PAYMENT_ID.test(paymentId) || !SIGNATURE.test(signature)) {
    return res.status(400).json({ error: 'missing or invalid payment details' });
  }

  // Razorpay signs "<order_id>|<payment_id>" with our secret on success; nobody
  // without the secret can produce a matching signature.
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    console.warn('[download] signature mismatch for', paymentId);
    return res.status(400).json({ error: 'payment could not be verified' });
  }

  // Belt and braces: confirm with Razorpay that this payment succeeded for our order.
  // Checked on the payment, not the order: an order only flips to "paid" once the
  // payment is captured, and accounts set to authorize-only leave it "attempted".
  const paymentRes = await razorpayFetch(`/payments/${paymentId}`);
  if (!paymentRes.ok) {
    console.warn('[download] payment lookup failed', paymentRes.status);
    return res.status(502).json({ error: 'could not verify payment with Razorpay' });
  }
  const payment = await paymentRes.json();
  if (payment.order_id !== orderId) {
    console.warn('[download] payment/order mismatch', paymentId, orderId);
    return res.status(400).json({ error: 'payment could not be verified' });
  }
  if (payment.status === 'authorized') {
    // Money is held but not taken yet, and Razorpay refunds it automatically if
    // nobody captures it. Capture it now so the buyer isn't refunded after
    // receiving the kit.
    const captureRes = await razorpayFetch(`/payments/${paymentId}/capture`, {
      method: 'POST',
      body: JSON.stringify({ amount: payment.amount, currency: payment.currency }),
    });
    if (!captureRes.ok) {
      console.warn('[download] capture failed', captureRes.status);
      return res.status(502).json({ error: 'could not complete the payment. Any hold on your card is released automatically. Please contact me' });
    }
  } else if (payment.status !== 'captured') {
    console.warn('[download] payment not successful, status =', payment.status);
    return res.status(402).json({ error: `payment not completed (status: ${payment.status})` });
  }

  const orderRes = await razorpayFetch(`/orders/${orderId}`);
  if (!orderRes.ok) {
    console.warn('[download] order lookup failed', orderRes.status);
    return res.status(502).json({ error: 'could not verify payment with Razorpay' });
  }
  const order = await orderRes.json();
  if (order.notes?.product !== PRODUCT_TAG) {
    console.warn('[download] order is for another product', orderId);
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

  const counterKey = `cockpit:dl:${paymentId}`;
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
