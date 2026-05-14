const path = require('path');
const express = require('express');
const { validate } = require('./config');
const { parseMessage } = require('./parser');
const { ensureAllTabs, logService, logRaw, appendGuestLog, appendPantryGuestLog, appendBothLogs, getGuestCountToday, getGuestHistory } = require('./sheets');

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

// ─── Guest Check-In (Phase 2) ──────────────────────────────────────────────

// Serve the check-in page
app.get('/checkin', (req, res) => {
  res.sendFile(path.join(__dirname, 'checkin.html'));
});

// API: submit a restaurant guest check-in
app.post('/api/checkin', async (req, res) => {
  console.log('[checkin] Restaurant check-in received:', JSON.stringify(req.body));
  const { name, zipCode, visitType, ageRange, meals, firstVisit, timestamp } = req.body;

  try {
    await appendGuestLog(config.sheets.serviceAccount, config.sheets.id, {
      name: name || '',
      zipCode: zipCode || '',
      visitType: visitType || '',
      ageRange: ageRange || '',
      meals: meals ?? 1,
      firstVisit: firstVisit || false,
      timestamp: timestamp || new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Guest check-in error:', err);
    res.status(500).json({ ok: false, error: 'Failed to write to sheet' });
  }
});

// API: submit a pantry guest check-in
app.post('/api/checkin/pantry', async (req, res) => {
  console.log('[checkin] Pantry check-in received:', JSON.stringify(req.body));
  const { name, zipCode, ageRange, bags, firstVisit, timestamp } = req.body;

  try {
    await appendPantryGuestLog(config.sheets.serviceAccount, config.sheets.id, {
      name: name || '',
      zipCode: zipCode || '',
      ageRange: ageRange || '',
      bags: bags ?? 1,
      firstVisit: firstVisit || false,
      timestamp: timestamp || new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Pantry check-in error:', err);
    res.status(500).json({ ok: false, error: 'Failed to write to sheet' });
  }
});

// API: submit a both (restaurant + pantry) guest check-in
app.post('/api/checkin/both', async (req, res) => {
  console.log('[checkin] Both check-in received:', JSON.stringify(req.body));
  const { name, zipCode, visitType, ageRange, meals, bags, firstVisit, timestamp } = req.body;

  try {
    await appendBothLogs(config.sheets.serviceAccount, config.sheets.id, {
      name: name || '',
      zipCode: zipCode || '',
      visitType: visitType || '',
      ageRange: ageRange || '',
      meals: meals ?? 1,
      bags: bags ?? 1,
      firstVisit: firstVisit || false,
      timestamp: timestamp || new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Both check-in error:', err);
    res.status(500).json({ ok: false, error: 'Failed to write to sheet' });
  }
});

// API: get guest history for autocomplete
app.get('/api/checkin/guests', async (req, res) => {
  try {
    const guests = await getGuestHistory(config.sheets.serviceAccount, config.sheets.id);
    res.json({ guests });
  } catch (err) {
    console.error('Guest history error:', err);
    res.json({ guests: [] });
  }
});

// API: get today's guest count
app.get('/api/checkin/count', async (req, res) => {
  try {
    const count = await getGuestCountToday(config.sheets.serviceAccount, config.sheets.id);
    res.json({ count });
  } catch (err) {
    console.error('Guest count error:', err);
    res.status(500).json({ count: 0 });
  }
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
  if (ms.sitdown) parts.push(`${ms.sitdown} sit-down`);
  if (ms.takeaway) parts.push(`${ms.takeaway} takeaway`);
  const derived = (ms.sitdown ?? 0) + (ms.takeaway ?? 0);
  const totalMeals = ms.total ?? (derived > 0 ? derived : null);
  if (totalMeals) parts.push(`${totalMeals} total meals`);
  if (ms.adults) parts.push(`${ms.adults} adults`);
  if (ms.children) parts.push(`${ms.children} children`);
  if (ms.seniors) parts.push(`${ms.seniors} seniors`);

  const fr = parsed.food_rescue || {};
  if (fr.baldor_lbs) parts.push(`Baldor ${fr.baldor_lbs} lbs`);
  for (const src of fr.other_sources || []) {
    if (src.lbs) parts.push(`${src.name} ${src.lbs} lbs`);
  }

  const p = parsed.pantry || {};
  if (p.pantry_guests) parts.push(`${p.pantry_guests} pantry guests`);
  if (p.bags_distributed) parts.push(`${p.bags_distributed} bags`);
  if (p.avg_bag_weight_lbs) parts.push(`avg ${p.avg_bag_weight_lbs} lbs/bag`);

  const k = parsed.kitchen || {};
  if (k.meal_requests) parts.push(`${k.meal_requests} meal requests`);
  if (k.avg_plate_weight_lbs) parts.push(`avg plate ${k.avg_plate_weight_lbs} lbs`);

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
