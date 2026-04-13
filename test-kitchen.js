#!/usr/bin/env node
/**
 * Refettorio Bot — Extensive Kitchen Simulation Test
 * Simulates real messages from multiple staff members in various styles.
 */

require('dotenv').config({ override: true });
const { parseMessage } = require('./parser');

const tests = [
  // Realistic dinner service logs
  { label: 'Standard dinner log', text: 'Tonight we served 87 sit-down meals, 23 takeaway, about 40% seniors, Baldor drop was 200 lbs' },
  { label: 'Quick text from chef', text: '102 total tonight. 15 kids 30 seniors rest adults' },
  { label: 'Voice-to-text sloppy', text: 'um so we did like 90 meals tonight mostly adults Baldor was maybe 180 pounds' },
  { label: 'Pantry only', text: 'Pantry had 45 guests, 38 bags at around 8 lbs each' },
  { label: 'Food rescue only', text: 'Got a Baldor delivery roughly 150 lbs maybe 300 dollar value. Also City Harvest dropped 60 lbs' },
  { label: 'Budget only', text: 'Budget was about 80 tonight. Served 65 sit-down no takeaway' },
  { label: 'Full service everything', text: 'Dinner: 95 sit-down, 18 takeaway, 20 kids, 35 seniors, rest adults. Baldor 175 lbs worth about 350. Pantry 40 guests 32 bags avg 7 lbs. Budget was 90 dollars' },

  // Typos and informal language
  { label: 'Typos and shorthand', text: 'tonite 78 sitdown 12 takeawya baldor 160lb' },
  { label: 'All lowercase no punctuation', text: 'served 55 meals tonight all adults no takeaway baldor was 120 lbs' },
  { label: 'Mixed caps and slang', text: 'YO we did 100 meals 2nite, like 25 kids rest grown ups, baldor dropped off maybe 200lbs' },

  // Multiple food rescue sources
  { label: 'Three rescue sources', text: 'Baldor 180 lbs, City Harvest 75 lbs worth maybe 150, and Whole Foods donated 40 lbs today' },
  { label: 'Unknown source', text: 'Someone dropped off about 50 lbs of produce, not sure who. Also got our usual Baldor 200 lbs' },

  // Edge cases
  { label: 'Just a number', text: '95 meals' },
  { label: 'Lunch service', text: 'Lunch today: 45 sit-down, 10 takeaway, mostly seniors' },
  { label: 'Spanish-influenced', text: 'Hoy servimos 80 comidas, 20 para llevar, Baldor trajo 150 libras' },
  { label: 'Plate weight included', text: '88 dinners tonight, avg plate was about 1.2 lbs, 15 meal requests came in' },
  { label: 'Percentages only', text: '110 total, 60% adults 15% children 25% seniors' },
  { label: 'Very short', text: '72 sitdown 8 takeaway' },
  { label: 'Rambling voice-to-text', text: 'OK so tonight was busy we had I think 95 maybe 100 sit down and then about 20 takeaway containers went out the door and Baldor came today with a big delivery I think it was around 250 pounds' },

  // Garbage / non-service messages
  { label: 'Greeting', text: 'Hey is this working?' },
  { label: 'Random question', text: 'What time is the delivery tomorrow?' },
  { label: 'Emoji only', text: '👍' },
];

async function run() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Refettorio Bot — Kitchen Simulation Test');
  console.log('  ' + tests.length + ' messages from simulated staff');
  console.log('═'.repeat(60));

  let highConf = 0;
  let lowConf = 0;
  let clarifications = 0;
  let errors = 0;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    try {
      const r = await parseMessage(t.text, process.env.ANTHROPIC_API_KEY);
      const conf = r.confidence;
      const clar = r.clarification_needed;
      const ms = r.meals_served || {};
      const fr = r.food_rescue || {};
      const p = r.pantry || {};
      const k = r.kitchen || {};

      // Build quick summary of what was parsed
      const bits = [];
      if (ms.total) bits.push(ms.total + ' meals');
      else if (ms.sitdown || ms.takeaway) bits.push((ms.sitdown || 0) + ' sit-down, ' + (ms.takeaway || 0) + ' takeaway');
      if (ms.adults) bits.push(ms.adults + ' adults');
      if (ms.children) bits.push(ms.children + ' children');
      if (ms.seniors) bits.push(ms.seniors + ' seniors');
      if (fr.baldor_lbs) bits.push(fr.baldor_lbs + 'lb Baldor');
      for (const s of fr.other_sources || []) {
        bits.push((s.lbs || '?') + 'lb ' + s.name);
      }
      if (p.pantry_guests) bits.push(p.pantry_guests + ' pantry guests');
      if (p.bags_distributed) bits.push(p.bags_distributed + ' bags');
      if (k.meal_requests) bits.push(k.meal_requests + ' meal requests');
      if (k.avg_plate_weight_lbs) bits.push(k.avg_plate_weight_lbs + 'lb avg plate');
      if (fr.ingredient_budget_usd) bits.push('$' + fr.ingredient_budget_usd + ' budget');

      let icon;
      if (conf === 'high' && !clar) { icon = '\u2705'; highConf++; }
      else if (clar) { icon = '\u26A0\uFE0F'; clarifications++; }
      else { icon = '\uD83D\uDFE1'; lowConf++; }

      console.log('\n' + icon + '  [' + (i + 1) + '/' + tests.length + '] ' + t.label);
      console.log('   Input:      ' + t.text);
      console.log('   Parsed:     ' + (bits.length ? bits.join(', ') : '(no service data)'));
      if (r.meal_type) console.log('   Meal type:  ' + r.meal_type);
      console.log('   Confidence: ' + conf + (clar ? '\n   Clarify:    ' + clar : ''));
    } catch (err) {
      console.log('\n\u274C  [' + (i + 1) + '/' + tests.length + '] ' + t.label);
      console.log('   Input: ' + t.text);
      console.log('   ERROR: ' + err.message);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  RESULTS');
  console.log('  ' + highConf + ' high confidence (no issues)');
  console.log('  ' + lowConf + ' low confidence');
  console.log('  ' + clarifications + ' asked for clarification');
  console.log('  ' + errors + ' errors');
  console.log('  ' + (highConf + lowConf + clarifications + errors) + ' total');
  console.log('═'.repeat(60) + '\n');
}

run().catch((e) => console.error(e));
