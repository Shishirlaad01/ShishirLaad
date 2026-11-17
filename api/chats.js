import { timingSafeEqual } from 'node:crypto';
import { INDEX_KEY, RETENTION_DAYS, convKey, turnsKey, validConversationId } from './_lib/conversations.js';
import { LEADS_KEY } from './_lib/leads.js';

// Private API behind the /admin/chats page. Requires the STATS_TOKEN value in
// an "Authorization: Bearer <token>" header (a header, not ?token=, so it
// doesn't end up in browser history or access logs).
//
//   GET /api/chats?offset=0      newest conversations, PAGE_SIZE at a time
//   GET /api/chats?leads=1&offset=0   only conversations with contact details
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
    // Contact details the visitor left, and any meeting booked (api/_lib/leads.js).
    lead: meta.lead_email
      ? {
          name: meta.lead_name || '', email: meta.lead_email, phone: meta.lead_phone || '',
          company: meta.lead_company || '', role: meta.lead_role || '', message: meta.lead_message || '',
          saved: meta.lead_saved || '',
        }
      : null,
    // status "unknown": a booking attempt whose result never came back; check the calendar.
    meeting: meta.meeting_start || meta.meeting_status === 'unknown'
      ? {
          start: meta.meeting_start || meta.meeting_requested, agenda: meta.meeting_agenda || '',
          link: meta.meeting_link || '', status: meta.meeting_start ? 'booked' : 'unknown',
        }
      : null,
  };
}

// Lists from the index of all conversations, or (leadsOnly) of those where
// the visitor left contact details.
async function listConversations(redis, offset, leadsOnly) {
  const now = Date.now();
  const key = leadsOnly ? LEADS_KEY : INDEX_KEY;
  // The leads index has no TTL of its own either.
  if (leadsOnly) await redis.zremrangebyscore(LEADS_KEY, 0, now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const [ids, total, lastWeek, leads] = await Promise.all([
    redis.zrange(key, offset, offset + PAGE_SIZE - 1, { rev: true }),
    redis.zcard(key),
    redis.zcount(INDEX_KEY, now - WEEK_MS, '+inf'),
    redis.zcard(LEADS_KEY),
  ]);
  if (ids.length === 0) return { conversations: [], total, lastWeek, leads, nextOffset: null };

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
  if (expired.length) await redis.zrem(key, ...expired);

  const nextOffset = offset + ids.length < total ? offset + ids.length : null;
  return { conversations, total: total - expired.length, lastWeek, leads, nextOffset };
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
    return res.status(200).json(await listConversations(redis, offset, req.query.leads === '1'));
  } catch (err) {
    console.error('chats: Upstash error', err?.message || err);
    return res.status(502).json({ error: 'could not read conversations' });
  }
}
