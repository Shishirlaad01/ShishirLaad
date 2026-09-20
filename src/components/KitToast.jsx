// Status banner for the Delivery Cockpit purchase. `status` is
// { kind: 'info'|'ok'|'error', text, retry? } or null.
export default function KitToast({ status, onDismiss }) {
  if (!status) return null;
  return (
    <div className={`kit-toast is-${status.kind}`} role="status">
      <span>{status.text}</span>
      {status.retry && <button type="button" className="kit-toast-retry" onClick={status.retry}>Try again</button>}
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}
