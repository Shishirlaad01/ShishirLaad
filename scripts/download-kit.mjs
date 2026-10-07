// Saves the Delivery Cockpit kit zip from Redis back to disk — the recovery path
// if the local copy is lost.
//
//   node --env-file=.env scripts/download-kit.mjs ["output.zip"] [--previous] [--force]
//
//   --previous  fetch the version that the last upload replaced, not the live one
//   --force     overwrite the output file if it already exists
//
// Needs myp_KV_REST_API_URL and myp_KV_REST_API_TOKEN in .env. Read-only: it never
// changes what customers receive.
import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';

const KIT_KEY = 'cockpit:kit'; // must match api/download.js
const BACKUP_KEY = 'cockpit:kit:previous'; // must match scripts/upload-kit.mjs

const args = process.argv.slice(2);
const wantPrevious = args.includes('--previous');
const force = args.includes('--force');
const out = args.find((a) => !a.startsWith('--')) || 'Docs/Dashboard cockpit.zip';

const url = process.env.myp_KV_REST_API_URL;
const token = process.env.myp_KV_REST_API_TOKEN;
if (!url || !token) {
  console.error('Missing myp_KV_REST_API_URL / myp_KV_REST_API_TOKEN in .env');
  process.exit(1);
}
// Refuse by default: the point of this script is recovery, and silently
// replacing a newer local file with an older Redis copy would undo work.
if (fs.existsSync(out) && !force) {
  console.error('%s already exists. Pass --force to overwrite it, or choose another file name.', out);
  process.exit(1);
}

const key = wantPrevious ? BACKUP_KEY : KIT_KEY;
const kit = await new Redis({ url, token }).get(key);
if (typeof kit !== 'string' || !kit) {
  console.error('Nothing stored under "%s".', key);
  process.exit(1);
}

const zip = Buffer.from(kit, 'base64');
if (zip.subarray(0, 2).toString('latin1') !== 'PK') {
  console.error('The data under "%s" is not a valid zip.', key);
  process.exit(1);
}

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, zip);
console.log('Saved "%s" (%d KB) to %s.', key, Math.round(zip.length / 1024), out);
