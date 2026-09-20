import { useEffect, useState } from 'react';
import { CHECKOUT_CHANNEL, SESSION_ID, downloadKit } from '../lib/kit.js';

// Waits for the checkout popup (/thanks) to report a completed purchase, then
// downloads the kit from this page so the popup can close itself.
export default function KitDownloadListener() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHECKOUT_CHANNEL);
    channel.onmessage = async (e) => {
      const { type, sessionId } = e.data || {};
      if (type !== 'paid' || !SESSION_ID.test(sessionId)) return;
      // Tell the popup we've got it, so it doesn't download a second copy.
      channel.postMessage({ type: 'ack' });
      setToast({ kind: 'info', text: 'Payment received. Downloading your kit…' });
      const result = await downloadKit(sessionId);
      setToast(result.ok
        ? { kind: 'ok', text: 'Thank you! Your Delivery Cockpit kit has been downloaded.' }
        : { kind: 'error', text: result.message });
    };
    return () => channel.close();
  }, []);

  if (!toast) return null;
  return (
    <div className={`kit-toast is-${toast.kind}`} role="status">
      <span>{toast.text}</span>
      <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
    </div>
  );
}
