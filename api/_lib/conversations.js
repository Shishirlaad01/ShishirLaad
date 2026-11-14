// Saves chat conversations to Upstash Redis so they can be read later.
//
// Keys (all expire 90 days after the conversation's last message):
//   chat:conv:{id}        hash  started, updated, turns, country, region, city,
//                               source, referrer, landing, device
//   chat:conv:{id}:turns  list  one JSON entry per exchange:
//                               { at, user, assistant, stop }
//   chat:convs            zset  conversation ids scored by last-update time (ms),
//                               newest first with ZRANGE ... REV
//
// Visitor IPs are never stored; location comes from Vercel's geo headers.

export const RETENTION_DAYS = 90;
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
export const INDEX_KEY = 'chat:convs';
export const convKey = (id) => `chat:conv:${id}`;
export const turnsKey = (id) => `chat:conv:${id}:turns`;

// crypto.randomUUID() format; anything else from the browser is ignored.
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validConversationId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id) ? id.toLowerCase() : null;
}

function short(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function header(req, name) {
  const value = req.headers[name];
  if (!value) return '';
  try {
    // Vercel URL-encodes city names (e.g. "S%C3%A3o%20Paulo").
    return decodeURIComponent(Array.isArray(value) ? value[0] : value);
  } catch {
    return String(value);
  }
}

function deviceFrom(userAgent = '') {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return 'phone';
  return 'desktop';
}

const SOURCES = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)github\.com$/, 'GitHub'],
  [/(^|\.)(x|twitter)\.com$|^t\.co$/, 'X'],
  [/(^|\.)facebook\.com$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(chatgpt|openai)\.com$/, 'ChatGPT'],
  [/(^|\.)(claude|anthropic)\.ai$|(^|\.)perplexity\.ai$/, 'AI assistant'],
];

// Where the visitor came from: an explicit ?utm_source wins, then the
// referring site's name, then "Direct" (typed the URL, bookmark, or an app
// that strips the referrer, such as many email clients).
function sourceFrom(referrerHost, utmSource, ownHost) {
  if (utmSource) return utmSource;
  if (!referrerHost || referrerHost === ownHost) return 'Direct';
  const match = SOURCES.find(([pattern]) => pattern.test(referrerHost));
  return match ? match[1] : referrerHost;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

// Facts about the visitor, recorded once when the conversation starts.
function visitorDetails(req, context = {}) {
  // Only the referring site's hostname is kept: full referrer URLs can carry
  // search terms or tokens.
  const referrer = hostOf(short(context.referrer, 500));
  const ownHost = (header(req, 'host') || '').split(':')[0].replace(/^www\./, '').toLowerCase();
  return {
    country: header(req, 'x-vercel-ip-country') || 'unknown',
    region: header(req, 'x-vercel-ip-country-region'),
    city: header(req, 'x-vercel-ip-city'),
    source: sourceFrom(referrer, short(context.utmSource, 60), ownHost),
    referrer: referrer === ownHost ? '' : referrer,
    landing: short(context.page, 200) || '/',
    device: deviceFrom(req.headers['user-agent']),
  };
}

// Records one exchange. Never throws: losing a transcript must not break the
// visitor's reply.
export async function saveTurn(redis, { id, req, context, user, assistant, stop }) {
  if (!id) return;
  try {
    const now = Date.now();
    const at = new Date(now).toISOString();
    const key = convKey(id);
    // First exchange of this conversation: store who/where/how once.
    const isNew = await redis.hsetnx(key, 'started', at);
    if (isNew) await redis.hset(key, visitorDetails(req, context));
    await Promise.all([
      redis.rpush(turnsKey(id), JSON.stringify({ at, user, assistant, stop })),
      redis.hset(key, { updated: at }),
      redis.hincrby(key, 'turns', 1),
      redis.zadd(INDEX_KEY, { score: now, member: id }),
    ]);
    await Promise.all([
      redis.expire(key, RETENTION_SECONDS),
      redis.expire(turnsKey(id), RETENTION_SECONDS),
      // The index has no TTL of its own; drop ids whose data has expired.
      redis.zremrangebyscore(INDEX_KEY, 0, now - RETENTION_SECONDS * 1000),
    ]);
  } catch (err) {
    console.error('chat: could not save conversation', err?.message || err);
  }
}
