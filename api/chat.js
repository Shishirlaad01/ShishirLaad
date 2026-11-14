import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './_lib/profile.js';

// POST { messages: [{ role: 'user'|'assistant', content: string }, ...] }
// Streams the assistant's reply as server-sent events:
//   data: {"text":"..."}   one per chunk
//   data: {"done":true}    reply finished
//   data: {"error":"..."}  failed after streaming began
// Failures before streaming starts come back as ordinary JSON with a status code.

// Override with CHAT_MODEL in the environment to trade quality for cost.
const MODEL = process.env.CHAT_MODEL || 'claude-opus-5-5';
// Thinking tokens count against this too, so it is a cost ceiling per reply,
// not a target length — the system prompt keeps answers short.
const MAX_OUTPUT_TOKENS = 4000;

// The browser resends the whole conversation each turn, so all of it is
// visitor-controlled and has to be bounded here.
const MAX_MESSAGES = 24;
const MAX_USER_CHARS = 1000;
const MAX_ASSISTANT_CHARS = 6000;

// This endpoint spends money on every call and is open to the internet.
const LIMIT_PER_MINUTE = 6; // per visitor
const LIMIT_PER_DAY = 40; // per visitor
const LIMIT_GLOBAL_PER_DAY = Number(process.env.CHAT_DAILY_LIMIT) || 500; // all visitors

const BOT_UA = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|preview/i;

// Models that accept the server-side refusal fallback (see callClaude).
const SUPPORTS_FALLBACK = /^claude-(opus-5-5|sonnet-5-5)/.test(MODEL);

function parseMessages(body) {
  const list = body?.messages;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_MESSAGES) return null;
  const messages = [];
  for (const m of list) {
    if (m?.role !== 'user' && m?.role !== 'assistant') return null;
    if (typeof m.content !== 'string') return null;
    const content = m.content.trim();
    const max = m.role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (!content || content.length > max) return null;
    messages.push({ role: m.role, content });
  }
  if (messages[0].role !== 'user' || messages.at(-1).role !== 'user') return null;
  return messages;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

// Returns null when the request may proceed, or a message for the visitor.
async function checkRateLimit(req) {
  let redisLib;
  try {
    // Imported here because redis.js throws at load when the Upstash env vars
    // are missing, which local development must not require.
    redisLib = await import('./_lib/redis.js');
  } catch {
    // On Vercel, never run an unmetered paid endpoint. Locally, carry on.
    return process.env.VERCEL ? 'Chat is temporarily unavailable.' : null;
  }
  const { redis } = redisLib;

  // Hashed so raw visitor IPs are never stored.
  const visitor = createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minuteKey = `chat:rl:m:${visitor}:${now.toISOString().slice(0, 16)}`;
  const dayKey = `chat:rl:d:${visitor}:${day}`;
  const globalKey = `chat:global:${day}`;

  const [perMinute, perDay, global] = await Promise.all([
    redis.incr(minuteKey),
    redis.incr(dayKey),
    redis.incr(globalKey),
  ]);
  await Promise.all([
    redis.expire(minuteKey, 120),
    redis.expire(dayKey, 2 * 24 * 60 * 60),
    redis.expire(globalKey, 2 * 24 * 60 * 60),
  ]);

  if (perMinute > LIMIT_PER_MINUTE) return "You're sending messages quickly. Please wait a minute and try again.";
  if (perDay > LIMIT_PER_DAY) return "You've reached today's message limit for this chat.";
  if (global > LIMIT_GLOBAL_PER_DAY) return 'This chat has reached its daily limit.';

  // Counted here rather than through /api/track so it can't be inflated from the browser.
  await Promise.all([
    redis.hincrby(redisLib.TOTAL_KEY, 'chat_message', 1),
    redis.hincrby(redisLib.dailyKey(), 'chat_message', 1),
  ]);
  return null;
}

function callClaude(anthropic, messages) {
  const params = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    // Short factual answers: low effort keeps replies fast and cheap.
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  };
  if (SUPPORTS_FALLBACK) {
    // If a safety classifier declines a request, the API retries it on another
    // model inside the same call instead of returning nothing to the visitor.
    return anthropic.beta.messages.stream({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  }
  return anthropic.messages.stream(params);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (BOT_UA.test(req.headers['user-agent'] || '')) {
    return res.status(403).json({ error: 'not available' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const messages = parseMessages(body);
  if (!messages) {
    return res.status(400).json({ error: 'invalid messages' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'chat is not configured' });
  }

  const limited = await checkRateLimit(req);
  if (limited) {
    return res.status(429).json({ error: limited });
  }

  const anthropic = new Anthropic();
  const stream = callClaude(anthropic, messages);

  // Stop paying for a reply nobody is reading.
  res.on('close', () => {
    if (!res.writableEnded) stream.abort();
  });

  let started = false;
  const send = (payload) => {
    if (!started) {
      started = true;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
    }
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    let sentText = false;
    stream.on('text', (delta) => {
      sentText = true;
      send({ text: delta });
    });
    const final = await stream.finalMessage();
    if (!sentText) {
      // A refusal, or a reply with no text: never leave the visitor with a blank bubble.
      send({ text: "Sorry, I can't help with that. You can reach Shishir directly using the contact details on this page." });
    }
    send({ done: true, stopReason: final.stop_reason });
    res.end();
  } catch (err) {
    if (res.destroyed) return; // visitor left; nothing to report

    let status = 502;
    let message = 'The assistant is unavailable right now.';
    if (err instanceof Anthropic.RateLimitError) {
      status = 429;
      message = 'The assistant is busy right now. Please try again in a moment.';
    } else if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      status = 503;
      console.error('chat: Anthropic credentials rejected (%s)', err.status);
    } else if (err instanceof Anthropic.APIError) {
      console.error('chat: Anthropic API error %s: %s', err.status, err.message);
    } else {
      console.error('chat: unexpected error', err);
    }

    if (started) {
      send({ error: message });
      res.end();
    } else {
      res.status(status).json({ error: message });
    }
  }
}
