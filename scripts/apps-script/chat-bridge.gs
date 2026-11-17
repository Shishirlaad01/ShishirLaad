/**
 * Portfolio chat assistant ↔ your Google Calendar and Gmail.
 *
 * The chat assistant on your portfolio calls this script to:
 *   - read your calendar's busy times (to offer free meeting slots),
 *   - create a meeting with a Google Meet link and email the invite to the visitor,
 *   - email you when a visitor leaves their details or books a meeting.
 *
 * Setup (once):
 *   1. At https://script.google.com create a new project and paste this file in.
 *   2. Services (+ on the left) → add "Google Calendar API" (identifier: Calendar).
 *   3. Project Settings (gear) → Script properties → add CHAT_SECRET with the
 *      value of APPS_SCRIPT_SECRET from the site's .env.
 *   4. Run testSetup once from the editor and allow access when asked.
 *   5. Deploy → New deployment → Web app; Execute as: Me; Who has access: Anyone.
 *      Copy the Web app URL (ends in /exec) into APPS_SCRIPT_URL.
 *
 * Only requests carrying CHAT_SECRET are served; everything else is refused.
 */

var CALENDAR_ID = 'primary';

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: 'bad request' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('CHAT_SECRET');
  if (!secret || req.secret !== secret) return reply_({ ok: false, error: 'unauthorized' });

  try {
    switch (req.action) {
      case 'ping':
        return reply_({ ok: true });
      case 'events':
        return reply_({ ok: true, items: listEvents_(req.timeMin, req.timeMax) });
      case 'create':
        return reply_({ ok: true, event: createEvent_(req.event) });
      case 'email':
        sendEmail_(req.subject, req.text);
        return reply_({ ok: true });
      default:
        return reply_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return reply_({ ok: false, error: String((err && err.message) || err) });
  }
}

// Events between two times, with only what's needed to tell busy from free.
function listEvents_(timeMin, timeMax) {
  var result = Calendar.Events.list(CALENDAR_ID, {
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });
  return (result.items || []).map(function (ev) {
    var self = (ev.attendees || []).filter(function (a) { return a.self; })[0];
    return {
      status: ev.status,
      transparency: ev.transparency || 'opaque',
      start: ev.start,
      end: ev.end,
      declined: Boolean(self && self.responseStatus === 'declined'),
    };
  });
}

// Creates the meeting with a Google Meet link; Google emails the invite to the visitor.
function createEvent_(event) {
  if (!event || !event.start || !event.end || !event.attendees || event.attendees.length !== 1) {
    throw new Error('invalid event');
  }
  var created = Calendar.Events.insert(event, CALENDAR_ID, { conferenceDataVersion: 1, sendUpdates: 'all' });
  return { id: created.id, hangoutLink: created.hangoutLink || '', htmlLink: created.htmlLink || '' };
}

// Always to you (the account running this script), never to anyone else.
function sendEmail_(subject, text) {
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: String(subject || 'Portfolio chat').slice(0, 200),
    body: String(text || '').slice(0, 5000),
  });
}

function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor: asks for access, checks the calendar, sends a test email.
function testSetup() {
  var now = new Date();
  var week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  var events = listEvents_(now.toISOString(), week.toISOString());
  Logger.log('Calendar OK: ' + events.length + ' events in the next 7 days.');
  sendEmail_('Test: portfolio chat bridge', 'Your portfolio chat assistant can email you. Lead notifications will arrive like this.');
  Logger.log('Email OK: test email sent to ' + Session.getEffectiveUser().getEmail());
  if (!PropertiesService.getScriptProperties().getProperty('CHAT_SECRET')) {
    Logger.log('Reminder: add the CHAT_SECRET script property before deploying.');
  }
}
