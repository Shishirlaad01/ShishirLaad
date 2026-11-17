// Checks the Apps Script bridge the chat assistant uses for Calendar and Gmail,
// using APPS_SCRIPT_URL and APPS_SCRIPT_SECRET from .env (never printed):
//   node scripts/google-check.mjs          lists free meeting slots (read-only)
//   node scripts/google-check.mjs --email  also sends a test email to yourself

import fs from 'node:fs';
import { parseEnv } from 'node:util';

if (fs.existsSync('.env')) {
  for (const [k, v] of Object.entries(parseEnv(fs.readFileSync('.env', 'utf8')))) process.env[k] ??= v;
}
const { googleConfigured, pingBridge, findFreeSlots, emailShishir } = await import('../api/_lib/google.js');

if (!googleConfigured()) {
  const missing = ['APPS_SCRIPT_URL', 'APPS_SCRIPT_SECRET'].filter((k) => !process.env[k]);
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

try {
  await pingBridge();
  console.log('Bridge: connected, secret accepted.');
} catch (err) {
  console.error(`Bridge: failed (${err.message})`);
  process.exit(1);
}

try {
  const slots = await findFreeSlots({ limit: 5 });
  console.log(`Calendar: connected. Next free slots (${slots.length}):`);
  for (const s of slots) console.log(`  ${s.label}`);
} catch (err) {
  console.error(`Calendar: failed (${err.message})`);
  process.exitCode = 1;
}

if (process.argv.includes('--email')) {
  try {
    await emailShishir({
      subject: 'Test: portfolio chat assistant can email you',
      text: 'This is a test from scripts/google-check.mjs. Lead notifications will arrive like this.',
    });
    console.log('Gmail: connected. Test email sent to your inbox.');
  } catch (err) {
    console.error(`Gmail: failed (${err.message})`);
    process.exitCode = 1;
  }
}
