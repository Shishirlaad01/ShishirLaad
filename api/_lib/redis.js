import { Redis } from '@upstash/redis';

// Auto-populated by the Vercel + Upstash integration — do not hardcode.
export const redis = Redis.fromEnv();

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
];

const BOT_UA = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|slackbot|telegrambot|discordbot|linkedinbot|twitterbot|headless|preview/i;

export function isBot(userAgent) {
  return BOT_UA.test(userAgent || '');
}

export function isMobile(userAgent) {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent || '');
}
