import { Fragment, useEffect, useRef, useState } from 'react';
import { track } from '../lib/track.js';
import { startCheckout, productTitle, PAY_EVENTS } from '../lib/kit.js';
import KitToast from './KitToast.jsx';

const GREETING = "Hi, I'm Shishir's AI assistant. Ask me about his experience, projects, or how he can help with your AI initiative.";

// Shown until the visitor sends their first message.
const STARTERS = [
  { label: "I'm hiring", text: "I'm hiring. Tell me about Shishir's experience and availability." },
  { label: 'I need an AI solution', text: 'I need an AI solution. How can Shishir help?' },
  { label: 'Just exploring', text: "I'm just exploring. Give me a quick overview of Shishir's work." },
];

// Shown when /api/chat can't answer (not configured, down, or offline).
const OFFLINE_REPLY = "I can't answer right now. You can reach Shishir directly at shishirlaad@gmail.com or on LinkedIn.";

const AUTO_OPEN_DELAY_MS = 800;
const DISMISSED_KEY = 'chat_dismissed';

// Matches the server's cap (api/chat.js MAX_MESSAGES) with room to spare.
const MAX_HISTORY = 20;

// One per page load; the server files every exchange under it.
function newConversationId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Older browsers without randomUUID (it needs a secure context).
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// How the visitor arrived, recorded with the conversation. Read at send time
// in the browser only (never during prerender).
function visitContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    referrer: document.referrer,
    utmSource: params.get('utm_source') || '',
    page: window.location.pathname,
  };
}

// `local` messages (the greeting, error notices) were never part of the model's
// conversation, so they aren't sent back to it.
function toApiMessages(history) {
  const sent = history.filter(m => !m.local).slice(-MAX_HISTORY);
  while (sent.length && sent[0].role !== 'user') sent.shift();
  return sent.map(m => ({ role: m.role, content: m.text }));
}

// Turns http(s) URLs, email addresses and phone numbers in a reply into links
// (the bot writes them as plain text). Trailing punctuation stays outside the
// link. React escapes the text, and hrefs are only ever http(s), mailto or tel.
const LINK_PATTERN = /https?:\/\/[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\+\d[\d -]{8,}\d/g;
function linkify(text) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const value = match[0].replace(/[.,;:!?)\]]+$/, '');
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (value.startsWith('http')) {
      parts.push(<a key={match.index} href={value} target="_blank" rel="noopener noreferrer">{value}</a>);
    } else if (value.includes('@')) {
      parts.push(<a key={match.index} href={`mailto:${value}`}>{value}</a>);
    } else {
      parts.push(<a key={match.index} href={`tel:${value.replace(/[ -]/g, '')}`}>{value}</a>);
    }
    last = match.index + value.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// The bot's replies use exactly two bits of formatting: **bold** titles and
// "- " pointers (see api/_lib/profile.js). Everything else stays plain text.
// An unclosed ** mid-stream just shows as typed until the closing pair arrives.
function formatReply(text) {
  return text.split(/\*\*([^*\n]+)\*\*/).map((segment, i) => (
    i % 2 === 1
      ? <strong key={i} className="chat-title">{segment}</strong>
      : <Fragment key={i}>{linkify(segment.replace(/^- /gm, '• '))}</Fragment>
  ));
}

// The bot asks for a Buy button by writing [[buy:<product id>]] in its reply
// (see api/_lib/profile.js). Markers are cut out of the text, and an unfinished
// one at the end of a streaming reply is hidden until it completes.
const BUY_MARKER = /\[\[buy:([a-z-]+)\]\]/g;
const PARTIAL_MARKER = /\[(\[(b(u(y(:[a-z-]*(\])?)?)?)?)?)?$/;
function splitReply(text) {
  const products = [];
  for (const [, id] of text.matchAll(BUY_MARKER)) {
    if (productTitle(id) && !products.includes(id)) products.push(id);
  }
  const clean = text.replace(BUY_MARKER, '').replace(PARTIAL_MARKER, '').replace(/[ \t]+\n/g, '\n').trimEnd();
  return { clean, products };
}

// Reads the endpoint's server-sent events, calling onText with each chunk.
async function readReply(res, onText) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const event of events) {
      if (!event.startsWith('data: ')) continue;
      const data = JSON.parse(event.slice(6));
      if (data.error) throw new Error(data.error);
      if (data.text) onText(data.text);
      if (data.done) return;
    }
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false); // current open was automatic, not a click
  const [messages, setMessages] = useState([{ role: 'assistant', text: GREETING, local: true }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [kitStatus, setKitStatus] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const openedOnce = useRef(false);
  const request = useRef(null);
  const conversationId = useRef(null);

  // Greet the visitor by opening the panel shortly after the page loads. Done in
  // an effect (not initial state) so the prerendered markup stays closed.
  useEffect(() => {
    // On phones the panel covers nearly the whole screen; leave the page visible.
    if (window.matchMedia('(max-width: 560px)').matches) return;
    try {
      // Closed once this session: don't push it at them again on reload.
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // sessionStorage unavailable — open anyway
    }
    const timer = setTimeout(() => {
      setAuto(true);
      setOpen(true);
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function close() {
    setOpen(false);
    setAuto(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // not remembered; harmless
    }
  }

  useEffect(() => {
    if (!open) return;
    // An automatic open isn't the visitor's doing: don't count it as engagement,
    // and don't pull keyboard focus away from the page they just arrived on.
    if (!auto) {
      if (!openedOnce.current) {
        openedOnce.current = true;
        track('chat_open');
      }
      inputRef.current?.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, auto]);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, open]);

  useEffect(() => () => request.current?.abort(), []);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const history = [...messages, { role: 'user', text: trimmed }];
    setMessages(history);
    setDraft('');
    setBusy(true);

    const controller = new AbortController();
    request.current = controller;
    let reply = '';
    conversationId.current ??= newConversationId();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: toApiMessages(history),
          conversationId: conversationId.current,
          context: visitContext(),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        // Rate-limit responses carry a message written for the visitor.
        const data = res.status === 429 ? await res.json().catch(() => null) : null;
        setMessages([...history, { role: 'assistant', text: data?.error || OFFLINE_REPLY, local: true }]);
        return;
      }
      await readReply(res, chunk => {
        reply += chunk;
        setMessages([...history, { role: 'assistant', text: reply }]);
      });
      if (!reply) throw new Error('empty reply');
    } catch {
      if (controller.signal.aborted) return;
      // Keep whatever arrived; a half answer plus a notice beats losing it.
      const partial = reply ? [{ role: 'assistant', text: reply }] : [];
      setMessages([...history, ...partial, { role: 'assistant', text: OFFLINE_REPLY, local: true }]);
    } finally {
      setBusy(false);
    }
  }

  // Dots show from sending until the first chunk of the reply arrives.
  const typing = busy && messages.at(-1).role === 'user';
  const showStarters = messages.length === 1 && !busy;

  return (
    <div className={`chat${open ? ' is-open' : ''}`}>
      <div
        className="chat-panel"
        id="chat-panel"
        role="dialog"
        aria-label="Chat with Shishir's AI assistant"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="chat-header">
          <span className="chat-avatar" aria-hidden="true">
            <SparkIcon />
          </span>
          <div className="chat-heading">
            <strong>Ask Shishir's AI</strong>
            <span>Experience, projects, AI solutions</span>
          </div>
          <button type="button" className="chat-close" aria-label="Close chat" onClick={close}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="chat-messages" ref={listRef} aria-live="polite">
          {messages.map((m, i) => {
            if (m.role !== 'assistant') return <p key={i} className="chat-msg is-user">{m.text}</p>;
            const { clean, products } = splitReply(m.text);
            return (
              <Fragment key={i}>
                {clean && <p className="chat-msg is-assistant">{formatReply(clean)}</p>}
                {products.length > 0 && (
                  <div className="chat-buy">
                    {products.map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          track(PAY_EVENTS[id]);
                          startCheckout(setKitStatus, id);
                        }}
                      >
                        Buy {productTitle(id)}
                      </button>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
          {typing && (
            <p className="chat-msg is-assistant chat-typing" aria-label="Assistant is typing">
              <span /><span /><span />
            </p>
          )}
          {showStarters && (
            <div className="chat-starters">
              {STARTERS.map(s => (
                <button key={s.label} type="button" onClick={() => sendMessage(s.text)}>{s.label}</button>
              ))}
            </div>
          )}
        </div>

        <form
          className="chat-form"
          onSubmit={e => {
            e.preventDefault();
            sendMessage(draft);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Type your question…"
            aria-label="Your message"
            maxLength={500}
            autoComplete="off"
          />
          <button type="submit" aria-label="Send message" disabled={!draft.trim() || busy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
            </svg>
          </button>
        </form>
        <p className="chat-notice">Chats are saved so Shishir can follow up.</p>
      </div>

      {/* Outside the panel so it stays visible (and fixed to the page) if the chat is closed. */}
      <KitToast status={kitStatus} onDismiss={() => setKitStatus(null)} />

      <button
        type="button"
        className="chat-launcher"
        aria-label={open ? 'Close chat' : "Chat with Shishir's AI assistant"}
        aria-expanded={open}
        aria-controls="chat-panel"
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.7 8.7 0 0 1-3.6-.8L3 21l1.9-5.2a8.1 8.1 0 0 1-.9-3.8A8.4 8.4 0 0 1 12.5 3.7 8.4 8.4 0 0 1 21 11.5Z" />
            <path d="M8.5 11.5h.01M12.5 11.5h.01M16.5 11.5h.01" />
          </svg>
        )}
      </button>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5Z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </svg>
  );
}
