import { Redis } from '@upstash/redis';

// This project's Vercel↔Upstash integration was set up with the custom
// prefix "myp_", so the injected vars are myp_KV_REST_API_URL /
// myp_KV_REST_API_TOKEN — not the unprefixed UPSTASH_REDIS_REST_URL /
// _TOKEN that Redis.fromEnv() looks for. Read them explicitly instead.
// (myp_KV_REST_API_READ_ONLY_TOKEN exists too but can't HINCRBY — writes
// need the read-write token above.)
const url = process.env.myp_KV_REST_API_URL;
const token = process.env.myp_KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error(
    'Missing myp_KV_REST_API_URL / myp_KV_REST_API_TOKEN — check the Upstash integration is connected to this project in Vercel → Settings → Environment Variables.'
  );
}

export const redis = new Redis({ url, token });

export const TOTAL_KEY = 'stats:total';

export function dailyKey(date = new Date()) {
  return `stats:daily:${date.toISOString().slice(0, 10)}`;
}

// Every field this app will ever increment. track.js rejects anything not
// listed here — without this allowlist, POST /api/track accepts arbitrary
// field names and anyone can flood the hash with junk keys.
export const EVENT_FIELDS = [
  'page_desktop',
  'page_mobile',
  'resume_download',
  'linkedin_hero',
  'linkedin_cta',
  'gpt_prompt-creator',
  'gpt_meeting-minutes',
  'gpt_scope-proposal',
  'gpt_document-formatter',
  'gpt_frd-creator',
  'gpt_frd-to-md',
  'cockpit_pay_click',
  'cockpit_download', // counted server-side in api/download.js, once per purchase
];

const BOT_UA = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|slackbot|telegrambot|discordbot|linkedinbot|twitterbot|headless|preview/i;

export function isBot(userAgent) {
  return BOT_UA.test(userAgent || '');
}

export function isMobile(userAgent) {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent || '');
}
