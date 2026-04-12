#!/usr/bin/env node
/**
 * Refettorio Bot — Full Pipeline Test
 * Run with: node test.js
 *
 * Tests the parser (Claude API) and Google Sheets write in one pass.
 * No real WhatsApp message needed.
 */

require('dotenv').config({ override: true });
const { validate } = require('./config');
const { parseMessage } = require('./parser');
const { ensureAllTabs, getSheetsClient, appendDailyLog, appendFoodRescue, appendRawLog, TABS } = require('./sheets');

const SAMPLE_MESSAGES = [
  {
    label: 'Dinner with demographics and Baldor rescue',
    text: 'Tonight we served 87 sit-down meals, 23 takeaway, about 40% seniors, Baldor drop was 200 lbs',
  },
  {
    label: 'Pantry-focused log',
    text: 'Pantry had 45 guests, 38 bags, avg 8 lbs each',
  },
  {
    label: 'Multi-source food rescue with budget',
    text: 'City Harvest dropped 60 lbs, ingredient budget was $75',
  },
];

let passCount = 0;
let failCount = 0;

function pass(label) {
  console.log(`  ✅ PASS  ${label}`);
  passCount++;
}

function fail(label, reason) {
  console.log(`  ❌ FAIL  ${label}`);
  console.log(`         Reason: ${reason}`);
  failCount++;
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ─── Part 1: Parser Tests ─────────────────────────────────────────────────────

async function runParserTests(config) {
  section('PART 1 — Parser (Claude API)');

  for (const sample of SAMPLE_MESSAGES) {
    process.stdout.write(`\n  Testing: "${sample.label}"...\n`);
    process.stdout.write(`  Input:   ${sample.text}\n`);
    try {
      const parsed = await parseMessage(sample.text, config.anthropic.apiKey);
      console.log('  Output:', JSON.stringify(parsed, null, 4).replace(/^/gm, '  '));

      // Basic sanity checks
      if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
        fail(sample.label, `Invalid or missing date: ${parsed.date}`);
      } else if (!['high', 'low'].includes(parsed.confidence)) {
        fail(sample.label, `Invalid confidence value: ${parsed.confidence}`);
      } else {
        pass(sample.label);
      }
    } catch (err) {
      fail(sample.label, err.message);
    }
  }
}

// ─── Part 2: Google Sheets Write Tests ───────────────────────────────────────

async function runSheetsTests(config) {
  section('PART 2 — Google Sheets (write + verify)');

  let sheetsClient;

  try {
    process.stdout.write('\n  Connecting to Google Sheets...\n');
    await ensureAllTabs(config.sheets.serviceAccount, config.sheets.id);
    sheetsClient = await getSheetsClient(config.sheets.serviceAccount);
    pass('Google Sheets connection and tab initialization');
  } catch (err) {
    fail('Google Sheets connection', err.message);
    console.log('\n  ⚠️  Skipping write tests because connection failed.');
    return;
  }

  const testDate = new Date().toISOString().split('T')[0];
  const testLoggedBy = 'test-runner';

  // Write to Daily Log
  try {
    const fakeLog = {
      date: testDate,
      meal_type: 'dinner',
      meals_served: { sitdown: 87, takeaway: 23, total: 110, adults: 44, children: 0, seniors: 44 },
      pantry: { bags_distributed: 38, avg_bag_weight_lbs: 8, pantry_guests: 45 },
      kitchen: { meal_requests: null, avg_plate_weight_lbs: null },
      food_rescue: {
        baldor_lbs: 200,
        baldor_value_usd: 400,
        other_sources: [],
        ingredient_budget_usd: null,
      },
    };
    await appendDailyLog(sheetsClient, config.sheets.id, fakeLog, testLoggedBy);
    pass(`Write test row to "Daily Log" tab`);
  } catch (err) {
    fail(`Write test row to "Daily Log" tab`, err.message);
  }

  // Write to Food Rescue
  try {
    const fakeFoodRescue = {
      date: testDate,
      food_rescue: {
        baldor_lbs: 200,
        baldor_value_usd: 400,
        other_sources: [{ name: 'City Harvest', lbs: 60, value_usd: null }],
        ingredient_budget_usd: 75,
      },
    };
    await appendFoodRescue(sheetsClient, config.sheets.id, fakeFoodRescue, testLoggedBy);
    pass(`Write test rows to "Food Rescue" tab`);
  } catch (err) {
    fail(`Write test rows to "Food Rescue" tab`, err.message);
  }

  // Write to Raw Log
  try {
    await appendRawLog(sheetsClient, config.sheets.id, {
      phoneNumber: testLoggedBy,
      rawMessage: '[test.js automated test]',
      parsedOk: true,
      notes: 'Written by test.js',
    });
    pass(`Write test row to "Raw Log" tab`);
  } catch (err) {
    fail(`Write test row to "Raw Log" tab`, err.message);
  }

  // Verify rows appeared (read back last row from Daily Log)
  try {
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: config.sheets.id,
      range: `'${TABS.DAILY_LOG}'!A:P`,
    });
    const rows = response.data.values || [];
    const lastRow = rows[rows.length - 1];

    if (!lastRow || lastRow[0] !== testDate) {
      fail('Verify Daily Log row was written', `Last row date is "${lastRow?.[0]}", expected "${testDate}"`);
    } else {
      pass(`Verify Daily Log row was written (last row date: ${lastRow[0]})`);
    }
  } catch (err) {
    fail('Verify Daily Log row was written', err.message);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║          Refettorio Bot — Pipeline Test Suite          ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  let config;
  try {
    config = validate();
  } catch (err) {
    console.error('\n❌ Configuration error:', err.message);
    console.error('Run `node setup.js` first to configure your credentials.');
    process.exit(1);
  }

  await runParserTests(config);
  await runSheetsTests(config);

  // Summary
  const total = passCount + failCount;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Results: ${passCount}/${total} tests passed`);
  if (failCount === 0) {
    console.log('  🎉 All tests passed! The bot is ready to use.');
  } else {
    console.log(`  ⚠️  ${failCount} test(s) failed. See details above.`);
    console.log('  Check your credentials and run `node setup.js` if needed.');
  }
  console.log('═'.repeat(60) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
