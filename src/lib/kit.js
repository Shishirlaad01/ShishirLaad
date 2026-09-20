// Delivery Cockpit purchase: Razorpay Checkout modal, then kit download.

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise;
// Loaded on first click rather than on every page view — most visitors never buy.
function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SCRIPT;
    s.onload = resolve;
    s.onerror = () => { scriptPromise = undefined; reject(new Error('load failed')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  return res;
}

// Sends the three values Razorpay returns after payment; the server verifies them
// and answers with the zip. Resolves to { ok: true, remaining } or
// { ok: false, message } — never throws.
export async function downloadKit(payment) {
  try {
    const res = await postJson('/api/download', payment);
    // Also checks the type: a host that answers unknown paths with 200 + HTML
    // must not look like a download.
    if (!res.ok || res.headers.get('Content-Type') !== 'application/zip') {
      const body = await res.json().catch(() => ({}));
      return { ok: false, message: body.error || 'Something went wrong. Please try again.' };
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Delivery-Cockpit-Kit.zip';
    a.click();
    URL.revokeObjectURL(a.href);
    return { ok: true, remaining: res.headers.get('X-Downloads-Remaining') };
  } catch {
    return { ok: false, message: 'Network error. Please try again.' };
  }
}

// Runs the whole purchase. `setStatus` receives { kind: 'info'|'ok'|'error', text,
// retry? } or null to clear the banner.
export async function startCheckout(setStatus) {
  setStatus({ kind: 'info', text: 'Opening secure checkout…' });

  let order;
  try {
    const res = await postJson('/api/create-order');
    if (!res.ok || !res.headers.get('Content-Type')?.includes('application/json')) {
      const body = await res.json().catch(() => ({}));
      setStatus({ kind: 'error', text: body.error || 'Checkout is unavailable right now. Please try again later.' });
      return;
    }
    order = await res.json();
    await loadCheckoutScript();
  } catch {
    setStatus({ kind: 'error', text: 'Could not open checkout. Check your connection and try again.' });
    return;
  }

  async function finish(payment) {
    setStatus({ kind: 'info', text: 'Payment received. Downloading your kit…' });
    const result = await downloadKit(payment);
    setStatus(result.ok
      ? { kind: 'ok', text: 'Thank you! Your Delivery Cockpit kit has been downloaded.' }
      // The buyer has paid: keep the proof so a failed download can be retried.
      : { kind: 'error', text: result.message, retry: () => finish(payment) });
  }

  const checkout = new window.Razorpay({
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency,
    name: 'Shishir Kumar Laad',
    description: 'Delivery Cockpit — dashboard kit',
    theme: { color: '#c8752f' },
    handler: (r) => finish({
      orderId: r.razorpay_order_id,
      paymentId: r.razorpay_payment_id,
      signature: r.razorpay_signature,
    }),
    modal: { ondismiss: () => setStatus(null) },
  });
  checkout.on('payment.failed', (r) => {
    setStatus({ kind: 'error', text: r.error?.description || 'Payment failed. Please try again.' });
  });
  setStatus(null);
  checkout.open();
}
