import { razorpayFetch, getProduct, localKitPath, DEFAULT_PRODUCT } from './_lib/razorpay.js';

// Creates the Razorpay order the checkout modal pays. The amount is decided here,
// from env vars — never taken from the browser, or anyone could pay ₹1.
// POST { product } — a product id from api/_lib/razorpay.js. Every product has the same price.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const productId = body?.product ?? DEFAULT_PRODUCT;
  const product = getProduct(productId);
  if (!product) {
    return res.status(400).json({ error: 'unknown product' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const price = Number(process.env.COCKPIT_PRICE);
  const currency = (process.env.COCKPIT_CURRENCY || 'INR').toUpperCase();
  if (!keyId || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured' });
  }
  if (!(price > 0)) {
    return res.status(500).json({ error: 'COCKPIT_PRICE not configured' });
  }

  // Refuse before taking money: without this, a buyer could pay for a kit that
  // hasn't been uploaded yet. Imported here because redis.js throws at load when
  // the Upstash env vars are missing, which local development must not require.
  if (!localKitPath(product)) {
    const { redis } = await import('./_lib/redis.js');
    if (!(await redis.exists(`${product.prefix}:kit`))) {
      return res.status(503).json({ error: `${product.label} is not available yet. Please contact me.` });
    }
  }

  // Razorpay amounts are in the smallest unit (paise, cents).
  const amount = Math.round(price * 100);

  const rzpRes = await razorpayFetch('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount,
      currency,
      receipt: `${product.prefix}_${Date.now()}`,
      notes: { product: productId },
    }),
  });
  if (!rzpRes.ok) {
    return res.status(502).json({ error: 'could not create the payment order' });
  }
  const order = await rzpRes.json();

  // keyId is the public half of the key pair, meant for the browser.
  return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId });
}
