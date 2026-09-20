// Shared by the main page (KitDownloadListener) and /thanks (thanks.jsx).

// Same-origin channel the /thanks popup uses to tell the main page that a
// purchase completed. BroadcastChannel rather than window.opener: Stripe's pages
// can sever the opener link, and this works between any same-origin windows.
export const CHECKOUT_CHANNEL = 'cockpit-checkout';

export const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

// Fetches the kit for a paid Checkout Session and saves it via a temporary link.
// Resolves to { ok: true, remaining } or { ok: false, message } — never throws.
export async function downloadKit(sessionId) {
  try {
    const res = await fetch(`/api/download?session_id=${encodeURIComponent(sessionId)}`);
    // Also checks the type: a host that answers unknown paths with 200 + HTML
    // (e.g. the Vite dev server without the dev API) must not look like a download.
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
