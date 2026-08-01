import { redis, TOTAL_KEY, dailyKey, EVENT_FIELDS } from './_lib/redis.js';

function zeroFilled(hash) {
  const out = {};
  for (const field of EVENT_FIELDS) out[field] = Number(hash?.[field] || 0);
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  // STATS_TOKEN is a value you choose and set in Vercel project env vars —
  // not related to the Upstash credentials. Without this check the endpoint
  // would leak traffic numbers to anyone who finds the URL.
  const expected = process.env.STATS_TOKEN;
  if (!expected) {
    return res.status(500).json({ error: 'STATS_TOKEN not configured' });
  }
  if (req.query.token !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const [totalHash, todayHash] = await Promise.all([
    redis.hgetall(TOTAL_KEY),
    redis.hgetall(dailyKey()),
  ]);

  return res.status(200).json({
    date: today,
    total: zeroFilled(totalHash),
    today: zeroFilled(todayHash),
  });
}
