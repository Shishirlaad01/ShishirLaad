// Stores the Delivery Cockpit kit zip in Redis so api/download.js can serve it to
// paying customers. Run it again to update the kit: the version being replaced is
// kept under a backup key, and scripts/download-kit.mjs can fetch either one.
//
//   node --env-file=.env scripts/upload-kit.mjs ["path/to/kit.zip"]
//
// Needs myp_KV_REST_API_URL and myp_KV_REST_API_TOKEN in .env (copy them from
// Vercel → Settings → Environment Variables). Writes to whichever Redis
// database those point at — use the same one the deployed site uses.
import fs from 'node:fs';
import { Redis } from '@upstash/redis';

const KIT_KEY = 'cockpit:kit'; // must match api/download.js
const BACKUP_KEY = 'cockpit:kit:previous'; // must match scripts/download-kit.mjs
// Upstash's REST request limit is 1 MB and base64 adds ~33%.
const MAX_BYTES = 700 * 1024;

const file = process.argv[2] || 'Docs/Dashboard cockpit.zip';
const url = process.env.myp_KV_REST_API_URL;
const token = process.env.myp_KV_REST_API_TOKEN;

if (!url || !token) {
  console.error('Missing myp_KV_REST_API_URL / myp_KV_REST_API_TOKEN in .env');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error('File not found: %s', file);
  process.exit(1);
}

const zip = fs.readFileSync(file);
if (zip.subarray(0, 2).toString('latin1') !== 'PK') {
  console.error('%s is not a zip file', file);
  process.exit(1);
}
if (zip.length > MAX_BYTES) {
  console.error('Zip is %d KB; limit is %d KB. Shrink it or move it to blob storage.', Math.round(zip.length / 1024), MAX_BYTES / 1024);
  process.exit(1);
}

const redis = new Redis({ url, token });
const encoded = zip.toString('base64');
const current = await redis.get(KIT_KEY);

if (current === encoded) {
  console.log('Redis already holds this exact kit (%d KB). Nothing to do.', Math.round(zip.length / 1024));
  process.exit(0);
}
if (typeof current === 'string' && current) {
  await redis.set(BACKUP_KEY, current);
  console.log('Saved the version being replaced as "%s".', BACKUP_KEY);
}

await redis.set(KIT_KEY, encoded);
console.log('Uploaded %s (%d KB) to Redis key "%s".', file, Math.round(zip.length / 1024), KIT_KEY);
