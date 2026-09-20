// Stamped on every order we create so a paid order for anything else on the same
// Razorpay account can't unlock the kit.
export const PRODUCT_TAG = 'delivery-cockpit';

export function razorpayFetch(path, init = {}) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', ...init.headers },
  });
}
