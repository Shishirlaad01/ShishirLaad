// Shishir's Google Calendar and Gmail, used by the chat assistant to book
// meetings and to email him when a visitor leaves their details.
//
// Reached through a Google Apps Script web app running in his own account
// (scripts/apps-script/chat-bridge.gs), so there is no Google Cloud OAuth app
// to publish and no token that expires. Env (set in Vercel):
//   APPS_SCRIPT_URL      the web app's /exec URL
//   APPS_SCRIPT_SECRET   shared secret; the script refuses requests without it

// Meetings: one hour, starting on the hour from 11:00 to 17:00 India time
// (so they end by 18:00), Monday to Friday, at least MIN_NOTICE_HOURS ahead
// and at most BOOKING_WINDOW_DAYS out. India has no daylight saving.
export const TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const FIRST_START_HOUR = 11;
const LAST_START_HOUR = 17;
const MEETING_MS = 60 * 60 * 1000;
const MIN_NOTICE_HOURS = 4;
const BOOKING_WINDOW_DAYS = 21;

export function googleConfigured() {
  return Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SECRET);
}

// One call to the Apps Script web app. It answers a POST with a redirect to
// the result, which fetch follows. Errors come back as { ok: false, error }.
async function bridge(action, payload = {}) {
  const res = await fetch(process.env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.APPS_SCRIPT_SECRET, action, ...payload }),
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`apps script HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(`apps script ${action}: ${data?.error || 'unexpected response'}`);
  return data;
}

export async function pingBridge() {
  await bridge('ping');
}

// ---- Time helpers (India time, no DST) ----

// The India-time calendar date and hour of an instant, read from UTC fields
// of the shifted time.
function istParts(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), weekday: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

function istInstant(y, m, d, hour) {
  return Date.UTC(y, m, d, hour) - IST_OFFSET_MS;
}

export function slotLabel(ms) {
  const fmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return `${fmt.format(new Date(ms))} IST`;
}

// Every allowed meeting start time from now to the end of the booking window.
function candidateSlots(now = Date.now()) {
  const earliest = now + MIN_NOTICE_HOURS * 60 * 60 * 1000;
  const today = istParts(now);
  const slots = [];
  for (let day = 0; day <= BOOKING_WINDOW_DAYS; day++) {
    const base = istParts(istInstant(today.y, today.m, today.d + day, 12));
    if (base.weekday === 0 || base.weekday === 6) continue;
    for (let hour = FIRST_START_HOUR; hour <= LAST_START_HOUR; hour++) {
      const start = istInstant(base.y, base.m, base.d, hour);
      if (start >= earliest) slots.push(start);
    }
  }
  return slots;
}

// Checks a start time against the meeting rules, independently of the
// calendar. Returns an error message, or null when the time is allowed.
export function slotRuleError(startMs, now = Date.now()) {
  if (!Number.isFinite(startMs)) return 'The time could not be read. Use an ISO time from find_meeting_slots.';
  if (!candidateSlots(now).includes(startMs)) {
    return `Meetings are one hour, starting on the hour between 11:00 AM and 5:00 PM IST, Monday to Friday, at least ${MIN_NOTICE_HOURS} hours ahead and within ${BOOKING_WINDOW_DAYS} days.`;
  }
  return null;
}

// Busy ranges on the calendar between two instants: events that block time
// (not marked "free") and that Shishir hasn't declined.
async function busyRanges(fromMs, toMs) {
  const data = await bridge('events', {
    timeMin: new Date(fromMs).toISOString(),
    timeMax: new Date(toMs).toISOString(),
  });
  const ranges = [];
  for (const event of data.items || []) {
    if (event.status === 'cancelled' || event.transparency === 'transparent' || event.declined) continue;
    // All-day events (holidays, leave) block the whole day.
    const start = event.start?.dateTime ? Date.parse(event.start.dateTime) : Date.parse(`${event.start?.date}T00:00:00+05:30`);
    const end = event.end?.dateTime ? Date.parse(event.end.dateTime) : Date.parse(`${event.end?.date}T00:00:00+05:30`);
    if (Number.isFinite(start) && Number.isFinite(end)) ranges.push([start, end]);
  }
  return ranges;
}

const overlaps = (start, ranges) => ranges.some(([s, e]) => start < e && start + MEETING_MS > s);

// Free one-hour slots, starting from `fromDate` (YYYY-MM-DD, India time) when
// given. At most `perDay` per day and `limit` overall, so the reply can offer
// a spread of days rather than one day's every hour.
export async function findFreeSlots({ fromDate, limit = 9, perDay = 3 } = {}) {
  let slots = candidateSlots();
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    const [y, m, d] = fromDate.split('-').map(Number);
    const from = istInstant(y, m - 1, d, 0);
    slots = slots.filter((s) => s >= from);
  }
  if (slots.length === 0) return [];
  const busy = await busyRanges(slots[0], slots.at(-1) + MEETING_MS);
  const free = [];
  const countPerDay = new Map();
  for (const start of slots) {
    if (overlaps(start, busy)) continue;
    const { y, m, d } = istParts(start);
    const day = `${y}-${m}-${d}`;
    if ((countPerDay.get(day) || 0) >= perDay) continue;
    countPerDay.set(day, (countPerDay.get(day) || 0) + 1);
    free.push({ start: new Date(start).toISOString(), label: slotLabel(start) });
    if (free.length >= limit) break;
  }
  return free;
}

export async function isFree(startMs) {
  return !overlaps(startMs, await busyRanges(startMs, startMs + MEETING_MS));
}

// Creates the event with a Google Meet link and invites the visitor, who gets
// Google's standard invitation email.
export async function createMeeting({ startMs, visitor, agenda }) {
  const who = [visitor.name, visitor.company].filter(Boolean).join(', ');
  const details = [
    `Name: ${visitor.name}`,
    visitor.company && `Company: ${visitor.company}`,
    visitor.role && `Role: ${visitor.role}`,
    `Email: ${visitor.email}`,
    visitor.phone && `Phone: ${visitor.phone}`,
  ].filter(Boolean);
  const description = [
    `Agenda: ${agenda}`,
    '',
    ...details,
    '',
    "Booked through the AI assistant on Shishir Kumar Laad's portfolio.",
  ].join('\n');
  const { event } = await bridge('create', {
    event: {
      summary: `Shishir Kumar Laad <> ${who}`,
      description,
      start: { dateTime: new Date(startMs).toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: new Date(startMs + MEETING_MS).toISOString(), timeZone: TIME_ZONE },
      attendees: [{ email: visitor.email, displayName: visitor.name }],
      conferenceData: {
        createRequest: { requestId: `chat-${startMs}-${Math.random().toString(36).slice(2)}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
      reminders: { useDefault: true },
    },
  });
  return { eventId: event.id, link: event.hangoutLink || event.htmlLink || '' };
}

// ---- Email to Shishir ----

// The script always sends to its own account (Shishir's), never elsewhere.
export async function emailShishir({ subject, text }) {
  await bridge('email', { subject: String(subject).replace(/[\r\n]+/g, ' ').slice(0, 200), text });
}
