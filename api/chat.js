import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { getSystemPrompt } from './_lib/profile.js';
import { saveTurn, validConversationId } from './_lib/conversations.js';

// POST { messages: [{ role: 'user'|'assistant', content: string }, ...],
//        conversationId?: uuid, context?: { referrer, utmSource, page } }
// With a conversationId, each exchange is saved (see _lib/conversations.js).
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

// Monthly cap across all visitors, sized so a month of chat costs about $5 on
// each model (estimated per message: Opus ~$0.01, Sonnet ~$0.005, Haiku
// ~$0.00025). Set CHAT_MONTHLY_LIMIT to override. The Anthropic Console spend
// limit is the hard guarantee; this keeps the bot from hitting it mid-month.
const DEFAULT_MONTHLY_LIMITS = [
  [/^claude-haiku/, 20000],
  [/^claude-sonnet/, 1000],
];
const LIMIT_GLOBAL_PER_MONTH =
  Number(process.env.CHAT_MONTHLY_LIMIT) ||
  DEFAULT_MONTHLY_LIMITS.find(([pattern]) => pattern.test(MODEL))?.[1] ||
  500;
// No single day may use more than a tenth of the month's allowance.
const LIMIT_GLOBAL_PER_DAY =
  Number(process.env.CHAT_DAILY_LIMIT) || Math.ceil(LIMIT_GLOBAL_PER_MONTH / 10);

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

// Imported lazily because redis.js throws at load when the Upstash env vars
// are missing, which local development must not require. Resolves to null then.
let redisLibPromise;
function loadRedis() {
  redisLibPromise ??= import('./_lib/redis.js').catch(() => null);
  return redisLibPromise;
}

// Returns null when the request may proceed, or a message for the visitor.
async function checkRateLimit(req) {
  const redisLib = await loadRedis();
  if (!redisLib) {
    // On Vercel, never run an unmetered paid endpoint. Locally, carry on.
    return process.env.VERCEL ? 'Chat is temporarily unavailable.' : null;
  }
  const { redis } = redisLib;

  // Hashed so raw visitor IPs are never stored.
  const visitor = createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const month = now.slice(0, 7);
  const minuteKey = `chat:rl:m:${visitor}:${now.slice(0, 16)}`;
  const dayKey = `chat:rl:d:${visitor}:${day}`;
  const globalDayKey = `chat:global:${day}`;
  const globalMonthKey = `chat:global:month:${month}`;

  // Per-visitor limits first, so one visitor hammering the endpoint uses up
  // only their own allowance, not everyone's shared daily and monthly budget.
  const [perMinute, perDay] = await Promise.all([redis.incr(minuteKey), redis.incr(dayKey)]);
  await Promise.all([
    redis.expire(minuteKey, 120),
    redis.expire(dayKey, 2 * 24 * 60 * 60),
  ]);
  if (perMinute > LIMIT_PER_MINUTE) return "You're sending messages quickly. Please wait a minute and try again.";
  if (perDay > LIMIT_PER_DAY) return "You've reached today's message limit for this chat.";

  const [globalDay, globalMonth] = await Promise.all([redis.incr(globalDayKey), redis.incr(globalMonthKey)]);
  await Promise.all([
    redis.expire(globalDayKey, 2 * 24 * 60 * 60),
    redis.expire(globalMonthKey, 40 * 24 * 60 * 60),
  ]);
  const contact = 'You can still reach Shishir directly by email or LinkedIn from this page.';
  if (globalMonth > LIMIT_GLOBAL_PER_MONTH) return `This chat has reached its monthly limit. ${contact}`;
  if (globalDay > LIMIT_GLOBAL_PER_DAY) return `This chat has reached its limit for today. ${contact}`;

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
    system: [{ type: 'text', text: getSystemPrompt(), cache_control: { type: 'ephemeral' } }],
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

  const conversationId = validConversationId(body.conversationId);
  let replyText = '';
  // Saves this exchange; awaited before the reply is closed so it completes
  // before Vercel freezes the function.
  const save = async (stop) => {
    const redisLib = conversationId && (await loadRedis());
    if (!redisLib) return;
    await saveTurn(redisLib.redis, {
      id: conversationId,
      req,
      context: body.context,
      user: messages.at(-1).content,
      assistant: replyText,
      stop,
    });
  };

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
      replyText += delta;
      send({ text: delta });
    });
    const final = await stream.finalMessage();
    // Token counts only, never conversation text: shows up in the Vercel
    // function logs (or the dev server output) for checking real cost.
    const u = final.usage;
    console.log(
      'chat usage: model=%s input=%d cache_write=%d cache_read=%d output=%d stop=%s',
      final.model, u.input_tokens, u.cache_creation_input_tokens ?? 0,
      u.cache_read_input_tokens ?? 0, u.output_tokens, final.stop_reason,
    );
    if (!sentText) {
      // A refusal, or a reply with no text: never leave the visitor with a blank bubble.
      replyText = "Sorry, I can't help with that. You can reach Shishir directly using the contact details on this page.";
      send({ text: replyText });
    }
    await save(final.stop_reason);
    send({ done: true, stopReason: final.stop_reason });
    res.end();
  } catch (err) {
    // Keep the question (and any partial answer) even when the reply failed.
    await save(res.destroyed ? 'visitor_left' : 'error');
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
