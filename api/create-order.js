import { razorpayFetch, PRODUCT_TAG } from './_lib/razorpay.js';

// Creates the Razorpay order the checkout modal pays. The amount is decided here,
// from env vars — never taken from the browser, or anyone could pay ₹1.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
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

  // Razorpay amounts are in the smallest unit (paise, cents).
  const amount = Math.round(price * 100);

  const rzpRes = await razorpayFetch('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount,
      currency,
      receipt: `cockpit_${Date.now()}`,
      notes: { product: PRODUCT_TAG },
    }),
  });
  if (!rzpRes.ok) {
    return res.status(502).json({ error: 'could not create the payment order' });
  }
  const order = await rzpRes.json();

  // keyId is the public half of the key pair, meant for the browser.
  return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId });
}
