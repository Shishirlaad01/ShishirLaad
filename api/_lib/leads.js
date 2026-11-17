import { promises as dns } from 'node:dns';
import { convKey, RETENTION_DAYS } from './conversations.js';
import {
  googleConfigured, findFreeSlots, isFree, createMeeting, emailShishir, slotRuleError, slotLabel,
} from './google.js';

// Tools the chat assistant can call: save a visitor's contact details (so
// Shishir can follow up), and find and book a meeting on his calendar.
//
// Everything a tool receives was written by the model from visitor messages,
// so it is untrusted: validated here, capped per conversation and per day, and
// contact details must appear in what the visitor actually typed.
//
// Lead data lives on the conversation's hash (chat:conv:{id}) as lead_* and
// meeting_* fields, so it expires with the conversation. chat:leads indexes
// conversations that have one, for the dashboard's "Leads" view.

export const LEADS_KEY = 'chat:leads';
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
const MAX_TOOL_CALLS_PER_CONVERSATION = 12;
const MAX_BOOKINGS_PER_DAY = 5;

const SAVE_CONTACT = {
  name: 'save_visitor_contact',
  description:
    "Save the visitor's contact details so Shishir can contact them. Call this as soon as the visitor has shared at least their name and email address. Only pass details the visitor typed themselves in this conversation. The result says whether the details were valid and saved; if not, it says what to ask the visitor to correct.",
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The visitor's name." },
      email: { type: 'string', description: "The visitor's email address, exactly as they typed it." },
      phone: { type: 'string', description: "The visitor's phone number with country code, if they shared one." },
      company: { type: 'string', description: 'Their company, if shared.' },
      role: { type: 'string', description: 'The role or position they are hiring for, or what they want help with, if shared.' },
      message: { type: 'string', description: 'A one-sentence summary of what the visitor wants to discuss with Shishir.' },
    },
    required: ['name', 'email'],
  },
};

const FIND_SLOTS = {
  name: 'find_meeting_slots',
  description:
    "Find free one-hour slots on Shishir's calendar (11:00 AM to 6:00 PM India time, Monday to Friday). Call this when the visitor wants to schedule a meeting or interview, after their contact details are saved.",
  input_schema: {
    type: 'object',
    properties: {
      from_date: { type: 'string', description: 'Optional earliest date the visitor prefers, as YYYY-MM-DD.' },
    },
  },
};

const BOOK_MEETING = {
  name: 'book_meeting',
  description:
    "Book a one-hour meeting with Shishir in a slot returned by find_meeting_slots and send the visitor a calendar invitation with a Google Meet link at their saved email address. Only call this after the visitor has chosen a slot and given a brief agenda.",
  input_schema: {
    type: 'object',
    properties: {
      start: { type: 'string', description: 'The chosen slot start time, exactly as find_meeting_slots returned it (ISO 8601).' },
      agenda: { type: 'string', description: "The visitor's brief agenda for the meeting, in their words." },
    },
    required: ['start', 'agenda'],
  },
};

// Calendar tools are offered only when Google is connected; without them the
// assistant still takes contact details and tells the visitor Shishir will
// arrange a time.
export function chatTools() {
  return googleConfigured() ? [SAVE_CONTACT, FIND_SLOTS, BOOK_MEETING] : [SAVE_CONTACT];
}

// ---- Validation ----

const text = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

const DISPOSABLE = /(^|\.)(mailinator|guerrillamail|10minutemail|tempmail|temp-mail|yopmail|trashmail|sharklasers|getnada|dispostable|maildrop|throwawaymail)\./i;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);
}

// Whether the domain can receive mail: a real MX record, or (with no MX at all)
// an address record. DNS trouble on our side is not the visitor's fault, so
// anything other than a clear "no such domain" is accepted.
async function domainReceivesMail(domain) {
  try {
    const records = await withTimeout(dns.resolveMx(domain), 3000);
    return records.some((r) => r.exchange && r.exchange !== '.');
  } catch (err) {
    if (err.code === 'ENOTFOUND') return false;
    if (err.code === 'ENODATA') {
      try {
        return (await withTimeout(dns.resolve4(domain), 3000)).length > 0;
      } catch (e) {
        return e.code !== 'ENOTFOUND' && e.code !== 'ENODATA';
      }
    }
    return true;
  }
}

async function emailError(email) {
  if (!EMAIL.test(email) || email.length > 254) return 'The email address is not in a valid format.';
  const domain = email.split('@')[1].toLowerCase();
  if (DISPOSABLE.test(domain)) return 'That looks like a temporary email address; ask for a permanent one.';
  if (!(await domainReceivesMail(domain))) return `The domain "${domain}" cannot receive email; ask the visitor to check the address.`;
  return null;
}

const digits = (value) => String(value).replace(/\D/g, '');

function phoneError(phone) {
  if (!/^\+?[\d\s().-]+$/.test(phone)) return 'The phone number contains characters that are not digits.';
  const d = digits(phone);
  if (d.length < 8 || d.length > 15) return 'The phone number should have 8 to 15 digits including the country code.';
  if (/^(\d)\1+$/.test(d) || '01234567890123456789'.includes(d) || '98765432109876543210'.includes(d)) {
    return 'The phone number does not look real; ask the visitor to check it.';
  }
  return null;
}

// The model must not invent contact details: each one has to appear in a
// message the visitor wrote.
function typedByVisitor(value, userMessages, compare) {
  return userMessages.some((m) => compare(m).includes(compare(value)));
}

// ---- Storage ----

async function conversationLead(redis, id) {
  return (await redis.hgetall(convKey(id))) || {};
}

async function countToolCall(redis, id) {
  const calls = await redis.hincrby(convKey(id), 'tool_calls', 1);
  await redis.expire(convKey(id), RETENTION_SECONDS);
  return calls <= MAX_TOOL_CALLS_PER_CONVERSATION;
}

async function notify(subject, lines) {
  if (!googleConfigured()) return;
  try {
    await emailShishir({ subject, text: lines.filter(Boolean).join('\n') });
  } catch (err) {
    console.error('chat: lead email failed', err?.message || err);
  }
}

function leadLines(lead, ctx) {
  return [
    `Name: ${lead.lead_name}`,
    `Email: ${lead.lead_email}`,
    lead.lead_phone && `Phone: ${lead.lead_phone}`,
    lead.lead_company && `Company: ${lead.lead_company}`,
    lead.lead_role && `Role / need: ${lead.lead_role}`,
    lead.lead_message && `Wants to discuss: ${lead.lead_message}`,
    '',
    `Read the conversation: ${ctx.siteUrl}/admin/chats#${ctx.conversationId}`,
  ];
}

// ---- Tool implementations ----

async function saveContact(input, ctx) {
  const lead = {
    name: text(input.name, 80),
    email: text(input.email, 254).toLowerCase(),
    phone: text(input.phone, 30),
    company: text(input.company, 120),
    role: text(input.role, 160),
    message: text(input.message, 300),
  };
  const problems = [];
  if (lead.name.length < 2) problems.push("The visitor's name is missing.");
  const badEmail = await emailError(lead.email);
  if (badEmail) problems.push(badEmail);
  else if (!typedByVisitor(lead.email, ctx.userMessages, (s) => s.toLowerCase())) {
    problems.push('The email address must be one the visitor typed; ask them for it.');
  }
  if (lead.phone) {
    const badPhone = phoneError(lead.phone);
    if (badPhone) problems.push(badPhone);
    else if (!typedByVisitor(lead.phone, ctx.userMessages, digits)) {
      problems.push('The phone number must be one the visitor typed; ask them for it.');
    }
  }
  if (problems.length) return { saved: false, problems };

  const { redis, conversationId: id } = ctx;
  const before = await conversationLead(redis, id);
  const fields = Object.fromEntries(
    Object.entries(lead).filter(([, v]) => v).map(([k, v]) => [`lead_${k}`, v]),
  );
  fields.lead_saved = new Date().toISOString();
  await redis.hset(convKey(id), fields);
  await Promise.all([
    redis.expire(convKey(id), RETENTION_SECONDS),
    redis.zadd(LEADS_KEY, { score: Date.now(), member: id }),
  ]);

  // Email Shishir once per conversation, when the details first arrive.
  if (!before.lead_notified) {
    await notify(`New lead from your portfolio chat: ${lead.name}${lead.company ? `, ${lead.company}` : ''}`, [
      'A visitor left their details with your portfolio chat assistant.',
      '',
      ...leadLines({ ...before, ...fields }, ctx),
    ]);
    await redis.hset(convKey(id), { lead_notified: new Date().toISOString() });
  }
  return {
    saved: true,
    calendar_available: googleConfigured(),
    note: googleConfigured()
      ? 'Saved. Shishir has been notified. You can offer to book a one-hour meeting with him.'
      : 'Saved. Shishir will see these details and contact the visitor directly.',
  };
}

async function findSlots(input, ctx) {
  const lead = await conversationLead(ctx.redis, ctx.conversationId);
  if (!lead.lead_email) return { error: "Save the visitor's contact details first (name and email), then look for slots." };
  if (lead.meeting_start) return { error: `A meeting is already booked for ${slotLabel(Date.parse(lead.meeting_start))}.` };
  const slots = await findFreeSlots({ fromDate: text(input.from_date, 10) });
  if (slots.length === 0) return { slots: [], note: 'No free slots in the next three weeks; tell the visitor Shishir will contact them to arrange a time.' };
  return { time_zone: 'India Standard Time (UTC+5:30)', slots };
}

async function bookMeeting(input, ctx) {
  const { redis, conversationId: id } = ctx;
  const lead = await conversationLead(redis, id);
  if (!lead.lead_email) return { booked: false, error: "Save the visitor's contact details first." };
  if (lead.meeting_start) return { booked: false, error: `A meeting is already booked for ${slotLabel(Date.parse(lead.meeting_start))}; only one per conversation.` };

  const agenda = text(input.agenda, 500);
  if (agenda.length < 10) return { booked: false, error: 'Ask the visitor for a brief agenda so Shishir can prepare.' };
  const startMs = Date.parse(text(input.start, 40));
  const ruleError = slotRuleError(startMs);
  if (ruleError) return { booked: false, error: ruleError };

  const dayKey = `chat:bookings:${new Date().toISOString().slice(0, 10)}`;
  const today = await redis.incr(dayKey);
  await redis.expire(dayKey, 2 * 24 * 60 * 60);
  if (today > MAX_BOOKINGS_PER_DAY) {
    return { booked: false, error: 'Online booking is paused for today; tell the visitor Shishir will contact them to arrange a time.' };
  }
  if (!(await isFree(startMs))) {
    await redis.decr(dayKey);
    return { booked: false, error: 'That slot was just taken. Call find_meeting_slots again and offer other times.' };
  }

  const visitor = {
    name: lead.lead_name, email: lead.lead_email, phone: lead.lead_phone,
    company: lead.lead_company, role: lead.lead_role,
  };
  const meeting = await createMeeting({ startMs, visitor, agenda });
  const start = new Date(startMs).toISOString();
  await redis.hset(convKey(id), {
    meeting_start: start, meeting_agenda: agenda, meeting_link: meeting.link, meeting_event: meeting.eventId,
  });
  await notify(`Meeting booked: ${slotLabel(startMs)} with ${visitor.name}`, [
    `Your portfolio chat assistant booked a one-hour meeting for ${slotLabel(startMs)}.`,
    `Agenda: ${agenda}`,
    meeting.link && `Google Meet: ${meeting.link}`,
    '',
    ...leadLines(lead, ctx),
  ]);
  return {
    booked: true,
    when: slotLabel(startMs),
    invitation_sent_to: visitor.email,
    note: 'The visitor will receive a Google Calendar invitation with a Google Meet link.',
  };
}

const HANDLERS = {
  [SAVE_CONTACT.name]: saveContact,
  [FIND_SLOTS.name]: findSlots,
  [BOOK_MEETING.name]: bookMeeting,
};

// Runs one tool call and returns the tool_result content (a JSON string).
// ctx: { redis, conversationId, userMessages: string[], siteUrl }
export async function runTool(name, input, ctx) {
  const handler = HANDLERS[name];
  if (!handler) return { content: JSON.stringify({ error: `Unknown tool ${name}.` }), isError: true };
  if (!ctx.redis || !ctx.conversationId) {
    return { content: JSON.stringify({ error: 'Saving is unavailable; give the visitor Shishir\'s contact details instead.' }), isError: true };
  }
  if (!(await countToolCall(ctx.redis, ctx.conversationId))) {
    return { content: JSON.stringify({ error: 'Too many attempts in this conversation; give the visitor Shishir\'s contact details instead.' }), isError: true };
  }
  try {
    const result = await handler(input && typeof input === 'object' ? input : {}, ctx);
    return { content: JSON.stringify(result), isError: Boolean(result.error) };
  } catch (err) {
    console.error('chat: tool %s failed: %s', name, err?.message || err);
    return {
      content: JSON.stringify({ error: 'That did not work because of a technical problem. Do not say it succeeded; offer Shishir\'s contact details instead.' }),
      isError: true,
    };
  }
}
