import { redis, TOTAL_KEY, dailyKey, EVENT_FIELDS, isBot, isMobile } from './_lib/redis.js';

// Keep daily hashes around for ~14 months so year-over-year "today" comparisons
// stay possible without the key set growing forever.
const DAILY_TTL_SECONDS = 400 * 24 * 60 * 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const userAgent = req.headers['user-agent'] || '';

  // Bots (including link-preview crawlers, now that the site prerenders) must
  // never inflate real visitor/engagement counts.
  if (isBot(userAgent)) {
    return res.status(204).end();
  }

  let event;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    event = body?.event;
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }

  // page_view doesn't map to a literal field — desktop/mobile split is
  // decided server-side from the request UA, never trusted from the client.
  let field;
  if (event === 'page_view') {
    field = isMobile(userAgent) ? 'page_mobile' : 'page_desktop';
  } else if (EVENT_FIELDS.includes(event)) {
    field = event;
  } else {
    return res.status(400).json({ error: 'unknown event' });
  }

  const today = dailyKey();
  await Promise.all([
    redis.hincrby(TOTAL_KEY, field, 1),
    redis.hincrby(today, field, 1),
    redis.expire(today, DAILY_TTL_SECONDS),
  ]);

  return res.status(204).end();
}
