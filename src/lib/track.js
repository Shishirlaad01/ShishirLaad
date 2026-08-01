// Fires a tracking beacon and never blocks the caller — a broken /api/track
// endpoint (or being run outside Vercel, e.g. `npm run dev`) must never break
// navigation or button clicks.
export function track(event) {
  try {
    const body = JSON.stringify({ event });

    // sendBeacon survives page unload; plain fetch gets cancelled mid-flight
    // when the browser navigates away immediately after a click (LinkedIn,
    // GPT links, resume download all do exactly that).
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/track', blob);
      return;
    }

    fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // tracking must never throw into caller code
  }
}

// One page_view per browser tab session, not once per component mount
// (React StrictMode double-invokes effects in dev and would double-count).
export function trackPageViewOnce() {
  try {
    if (sessionStorage.getItem('pv_sent')) return;
    sessionStorage.setItem('pv_sent', '1');
  } catch {
    // sessionStorage unavailable (private mode etc.) — fall through and track anyway
  }
  track('page_view');
}
