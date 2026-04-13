const express = require('express');
const { validate } = require('./config');
const { parseMessage } = require('./parser');
const { ensureAllTabs, logService, logRaw } = require('./sheets');

const config = validate();
const app = express();

// In-memory store for pending confirmations, keyed by phone number
// Each entry: { parsed, rawMessage, timestamp }
const pending = new Map();

// Auto-expire pending entries after 10 minutes
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;

// Twilio sends URL-encoded form data
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('Refettorio bot is running.');
});

// Twilio webhook
app.post('/webhook', async (req, res) => {
  const rawMessage = (req.body.Body || '').trim();
  const from = req.body.From || 'unknown';

  console.log(`[${new Date().toISOString()}] Message from ${from}: ${rawMessage}`);

  // Always respond with TwiML
  const twiml = (msg) =>
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${escapeXml(msg)}</Message></Response>`);

  if (!rawMessage) {
    return twiml(
      "Hmm, I didn't catch that. You can log meals served, food rescue, pantry, or kitchen data — just text it naturally."
    );
  }

  // Check if user is responding to a pending confirmation
  const pendingEntry = pending.get(from);

  if (pendingEntry) {
    // Check if it's expired
    if (Date.now() - pendingEntry.timestamp > PENDING_TIMEOUT_MS) {
      pending.delete(from);
      // Fall through to parse as a new message
    } else if (rawMessage === '0') {
      // Confirm — log to sheets
      pending.delete(from);
      try {
        await logService(config.sheets.serviceAccount, config.sheets.id, pendingEntry.parsed, from);
      } catch (err) {
        console.error('Sheets error:', err);
        return twiml(
          "I understood your message, but had trouble saving it to the spreadsheet. Please try again in a moment."
        );
      }
      const summary = buildSummary(pendingEntry.parsed);
      return twiml(`✅ Logged for ${pendingEntry.parsed.date}! ${summary}`);
    } else if (rawMessage === '1') {
      // Cancel
      pending.delete(from);
      await logRaw(config.sheets.serviceAccount, config.sheets.id, {
        phoneNumber: from,
        rawMessage: pendingEntry.rawMessage,
        parsedOk: false,
        notes: 'Cancelled by user',
      }).catch((e) => console.error('Failed to write raw log:', e));
      return twiml('❌ Cancelled. Send a new message whenever you\'re ready.');
    } else {
      // Neither 0 nor 1 — treat as a new message, discard old pending
      pending.delete(from);
    }
  }

  // Parse the new message
  let parsed = null;

  try {
    parsed = await parseMessage(rawMessage, config.anthropic.apiKey);
    parsed.logged_by = from;
  } catch (err) {
    console.error('Parser error:', err);
    await logRaw(config.sheets.serviceAccount, config.sheets.id, {
      phoneNumber: from,
      rawMessage,
      parsedOk: false,
      notes: `Parser error: ${err.message}`,
    }).catch((e) => console.error('Failed to write raw log:', e));

    return twiml(
      "Sorry, I had trouble reading that message. Please try again, or contact your admin if this keeps happening."
    );
  }

  // Log raw message regardless of outcome
  try {
    await logRaw(config.sheets.serviceAccount, config.sheets.id, {
      phoneNumber: from,
      rawMessage,
      parsedOk: parsed.confidence !== 'low' && !parsed.clarification_needed,
      notes: parsed.clarification_needed || '',
    });
  } catch (err) {
    console.error('Raw log error:', err);
  }

  // Ask for clarification if needed
  if (parsed.clarification_needed) {
    return twiml(`Got it — just need one thing: ${parsed.clarification_needed}`);
  }

  if (parsed.confidence === 'low') {
    return twiml(
      "I parsed your message but wasn't fully confident about some numbers. Could you double-check and resend with a bit more detail?"
    );
  }

  // Store as pending and ask for confirmation
  pending.set(from, { parsed, rawMessage, timestamp: Date.now() });

  const summary = buildSummary(parsed);
  return twiml(`📋 Ready to log for ${parsed.date}: ${summary}\n\nReply 0 to confirm, 1 to cancel.`);
});

function buildSummary(parsed) {
  const parts = [];

  const ms = parsed.meals_served || {};
  const derived = (ms.sitdown ?? 0) + (ms.takeaway ?? 0);
  const totalMeals = ms.total ?? (derived > 0 ? derived : null);
  if (totalMeals) parts.push(`${totalMeals} meals served`);

  const fr = parsed.food_rescue || {};
  if (fr.baldor_lbs) parts.push(`${fr.baldor_lbs} lbs Baldor rescue`);
  for (const src of fr.other_sources || []) {
    if (src.lbs) parts.push(`${src.lbs} lbs from ${src.name}`);
  }

  const p = parsed.pantry || {};
  if (p.pantry_guests) parts.push(`${p.pantry_guests} pantry guests`);
  if (p.bags_distributed) parts.push(`${p.bags_distributed} pantry bags`);

  const k = parsed.kitchen || {};
  if (k.meal_requests) parts.push(`${k.meal_requests} meal requests`);

  if (fr.ingredient_budget_usd) parts.push(`$${fr.ingredient_budget_usd} budget`);

  return parts.length > 0 ? parts.join(', ') + '.' : 'Data recorded.';
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Start server
const PORT = process.env.PORT || 3000;

ensureAllTabs(config.sheets.serviceAccount, config.sheets.id)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Refettorio bot listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to initialize Google Sheets tabs:', err.message);
    console.error('Check your GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEETS_ID.');
    process.exit(1);
  });
