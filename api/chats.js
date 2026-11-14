import { timingSafeEqual } from 'node:crypto';
import { INDEX_KEY, convKey, turnsKey, validConversationId } from './_lib/conversations.js';

// Private API behind the /admin/chats page. Requires the STATS_TOKEN value in
// an "Authorization: Bearer <token>" header (a header, not ?token=, so it
// doesn't end up in browser history or access logs).
//
//   GET /api/chats?offset=0      newest conversations, PAGE_SIZE at a time
//   GET /api/chats?id=<uuid>     one conversation with every exchange

const PAGE_SIZE = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function authorized(req) {
  const expected = process.env.STATS_TOKEN || '';
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!expected || !match) return false;
  const a = Buffer.from(match[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseTurn(raw) {
  // The client returns stored JSON already parsed; tolerate either form.
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function summary(id, meta, firstTurn) {
  return {
    id,
    started: meta.started,
    updated: meta.updated,
    turns: Number(meta.turns) || 0,
    country: meta.country || 'unknown',
    region: meta.region || '',
    city: meta.city || '',
    source: meta.source || 'Direct',
    referrer: meta.referrer || '',
    landing: meta.landing || '/',
    device: meta.device || '',
    firstQuestion: parseTurn(firstTurn)?.user || '',
  };
}

async function listConversations(redis, offset) {
  const now = Date.now();
  const [ids, total, lastWeek] = await Promise.all([
    redis.zrange(INDEX_KEY, offset, offset + PAGE_SIZE - 1, { rev: true }),
    redis.zcard(INDEX_KEY),
    redis.zcount(INDEX_KEY, now - WEEK_MS, '+inf'),
  ]);
  if (ids.length === 0) return { conversations: [], total, lastWeek, nextOffset: null };

  const pipe = redis.pipeline();
  for (const id of ids) {
    pipe.hgetall(convKey(id));
    pipe.lindex(turnsKey(id), 0);
  }
  const results = await pipe.exec();

  const conversations = [];
  const expired = [];
  ids.forEach((id, i) => {
    const meta = results[i * 2];
    if (!meta || !meta.started) expired.push(id); // data expired, index entry left over
    else conversations.push(summary(id, meta, results[i * 2 + 1]));
  });
  if (expired.length) await redis.zrem(INDEX_KEY, ...expired);

  const nextOffset = offset + ids.length < total ? offset + ids.length : null;
  return { conversations, total: total - expired.length, lastWeek, nextOffset };
}

async function getConversation(redis, id) {
  const [meta, turns] = await Promise.all([
    redis.hgetall(convKey(id)),
    redis.lrange(turnsKey(id), 0, -1),
  ]);
  if (!meta || !meta.started) return null;
  const parsed = turns.map(parseTurn).filter(Boolean);
  return { ...summary(id, meta, turns[0]), exchanges: parsed };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!process.env.STATS_TOKEN) {
    return res.status(500).json({ error: 'STATS_TOKEN not configured' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let redis;
  try {
    ({ redis } = await import('./_lib/redis.js'));
  } catch {
    return res.status(503).json({ error: 'Upstash is not configured' });
  }

  try {
    if (req.query.id !== undefined) {
      const id = validConversationId(req.query.id);
      const conversation = id && (await getConversation(redis, id));
      if (!conversation) return res.status(404).json({ error: 'conversation not found' });
      return res.status(200).json(conversation);
    }
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    return res.status(200).json(await listConversations(redis, offset));
  } catch (err) {
    console.error('chats: Upstash error', err?.message || err);
    return res.status(502).json({ error: 'could not read conversations' });
  }
}
