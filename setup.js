#!/usr/bin/env node
/**
 * Refettorio Bot — Interactive Setup Wizard
 * Run with: node setup.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ENV_PATH = path.join(__dirname, '.env');

// ─── Helpers ────────────────────────────────────────────────────────────────

function createRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

async function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

function print(msg) {
  console.log(msg);
}

function hr() {
  print('─'.repeat(60));
}

function writeEnv(vars) {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
}

function readExistingEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const result = {};
  for (const line of content.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) result[key.trim()] = rest.join('=').trim();
  }
  return result;
}

// ─── Validators ─────────────────────────────────────────────────────────────

function validateTwilioSid(value) {
  if (!value.startsWith('AC') || value.length < 10) {
    return 'Account SID should start with "AC" and be about 34 characters long.';
  }
  return null;
}

function validateAnthropicKey(value) {
  if (!value.startsWith('sk-ant-') && !value.startsWith('sk-')) {
    return 'API key should start with "sk-ant-" or "sk-".';
  }
  return null;
}

function validateSheetId(value) {
  // Google Sheet IDs are ~44 alphanumeric/dash/underscore characters
  if (value.length < 20 || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    return 'That doesn\'t look like a valid Sheet ID. Copy just the ID from the URL (between /d/ and /edit).';
  }
  return null;
}

function validateServiceAccountJson(value) {
  // Accept either a file path or raw JSON
  let json;

  if (value.endsWith('.json') && fs.existsSync(value)) {
    try {
      json = JSON.parse(fs.readFileSync(value, 'utf8'));
    } catch {
      return 'Could not read that JSON file. Make sure it is a valid JSON file.';
    }
  } else {
    try {
      json = JSON.parse(value);
    } catch {
      return 'That doesn\'t look like valid JSON. Paste the full contents of the key file, or enter the path to the .json file.';
    }
  }

  if (json.type !== 'service_account') {
    return 'This doesn\'t look like a service account key file. Make sure you downloaded the right file from Google Cloud.';
  }
  if (!json.client_email) {
    return 'The JSON is missing a "client_email" field. Download a fresh key from Google Cloud.';
  }

  return null; // valid
}

// ─── Google Sheets Connection Test ──────────────────────────────────────────

async function testSheetsConnection(serviceAccountJson, spreadsheetId) {
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountJson,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return {
    title: meta.data.properties.title,
    tabs: meta.data.sheets.map((s) => s.properties.title),
  };
}

// ─── Credential Collection ───────────────────────────────────────────────────

async function collectCredential(rl, existingEnv, key, description, instructions, validator) {
  print('');
  hr();
  print(`\n📋 ${description}`);
  print(`\n   ${instructions}\n`);

  const existing = existingEnv[key];
  if (existing) {
    const preview = existing.length > 20 ? existing.slice(0, 12) + '...' + existing.slice(-6) : existing;
    const keep = await ask(rl, `   You already have a value saved (${preview}). Keep it? (y/n): `);
    if (keep.toLowerCase() !== 'n') return existing;
  }

  while (true) {
    const value = await ask(rl, '   Your value: ');
    if (!value) {
      print('   ⚠️  Nothing entered. Please try again.');
      continue;
    }
    if (validator) {
      const error = validator(value);
      if (error) {
        print(`   ❌ ${error}`);
        continue;
      }
    }
    print('   ✅ Looks good!');
    return value;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  print('\n');
  print('╔════════════════════════════════════════════════════════╗');
  print('║        Refettorio Harlem — WhatsApp Bot Setup          ║');
  print('╚════════════════════════════════════════════════════════╝');
  print('');
  print('This wizard will help you set up all the credentials the bot');
  print('needs. You\'ll be asked for 6 pieces of information, one at a time.');
  print('');
  print('If you get stuck on any step, see the README.md for detailed instructions.');
  print('\nPress Enter to begin...');

  const rl = createRl();
  await ask(rl, '');

  const existing = readExistingEnv();
  const env = { ...existing };

  // 1. Twilio Account SID
  env.TWILIO_ACCOUNT_SID = await collectCredential(
    rl, existing,
    'TWILIO_ACCOUNT_SID',
    'Twilio Account SID',
    'Go to console.twilio.com → Log in → Your Account SID is on the main dashboard.\n   It starts with "AC" and is about 34 characters long.',
    validateTwilioSid
  );

  // 2. Twilio Auth Token
  env.TWILIO_AUTH_TOKEN = await collectCredential(
    rl, existing,
    'TWILIO_AUTH_TOKEN',
    'Twilio Auth Token',
    'Same page as the Account SID — click the eye icon to reveal the Auth Token.\n   Copy and paste it here.',
    (v) => (v.length < 10 ? 'That seems too short. Double-check you copied the full token.' : null)
  );

  // 3. Twilio WhatsApp Number
  env.TWILIO_WHATSAPP_NUMBER = await collectCredential(
    rl, existing,
    'TWILIO_WHATSAPP_NUMBER',
    'Twilio WhatsApp Number',
    'Go to console.twilio.com → Messaging → Try WhatsApp Sandbox.\n   The number shown is your sandbox number. Enter it as: whatsapp:+1XXXXXXXXXX',
    (v) => {
      if (!v.startsWith('whatsapp:+')) return 'Enter the number as: whatsapp:+1XXXXXXXXXX (include the "whatsapp:" prefix)';
      return null;
    }
  );

  // 4. Anthropic API Key
  env.ANTHROPIC_API_KEY = await collectCredential(
    rl, existing,
    'ANTHROPIC_API_KEY',
    'Anthropic API Key',
    'Go to console.anthropic.com → API Keys → Create Key.\n   Copy the key (starts with "sk-ant-").',
    validateAnthropicKey
  );

  // 5. Google Sheets ID
  env.GOOGLE_SHEETS_ID = await collectCredential(
    rl, existing,
    'GOOGLE_SHEETS_ID',
    'Google Sheets ID',
    'Open your Google Sheet in a browser.\n   Copy the long string of characters between /d/ and /edit in the URL.\n   Example URL: docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit\n   The ID would be: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    validateSheetId
  );

  // 6. Google Service Account JSON
  print('');
  hr();
  print('\n📋 Google Service Account JSON');
  print('');
  print('   This is the most involved step. Here\'s exactly what to do:');
  print('');
  print('   1. Go to console.cloud.google.com');
  print('   2. Create a new project (or select an existing one)');
  print('   3. Search for "Google Sheets API" → Enable it');
  print('   4. Go to IAM & Admin → Service Accounts → Create Service Account');
  print('   5. Name it anything (e.g. "refettorio-bot"), click Create and Continue');
  print('   6. Skip the optional steps, click Done');
  print('   7. Click on the service account you just created');
  print('   8. Go to Keys tab → Add Key → Create New Key → JSON → Create');
  print('   9. A .json file will download to your computer');
  print('  10. Open that file in a text editor, select all, and paste it here');
  print('      (or just type the file path, e.g. /Users/you/Downloads/key.json)');
  print('');
  print('  ⚠️  Also: open your Google Sheet → Share → paste the service account\'s');
  print('      email address (it looks like name@project.iam.gserviceaccount.com)');
  print('      and give it Editor access.');
  print('');

  let serviceAccountValue = '';
  let serviceAccountJson = null;

  while (true) {
    serviceAccountValue = await ask(rl, '   Paste JSON or file path: ');
    if (!serviceAccountValue) {
      print('   ⚠️  Nothing entered. Please try again.');
      continue;
    }

    const error = validateServiceAccountJson(serviceAccountValue);
    if (error) {
      print(`   ❌ ${error}`);
      continue;
    }

    // Resolve to JSON string (for .env storage)
    if (serviceAccountValue.endsWith('.json') && fs.existsSync(serviceAccountValue)) {
      const raw = fs.readFileSync(serviceAccountValue, 'utf8');
      serviceAccountJson = JSON.parse(raw);
      serviceAccountValue = raw.replace(/\n/g, '\\n'); // single line for .env
    } else {
      serviceAccountJson = JSON.parse(serviceAccountValue);
      serviceAccountValue = serviceAccountValue.replace(/\n/g, '\\n');
    }

    print('   ✅ JSON looks good!');
    break;
  }

  env.GOOGLE_SERVICE_ACCOUNT_JSON = serviceAccountValue;

  // Write .env
  print('');
  hr();
  print('\n💾 Saving your credentials to .env...');
  writeEnv(env);
  print('   ✅ Saved!');

  // Test Google Sheets connection
  print('\n🔌 Testing Google Sheets connection...');
  try {
    const info = await testSheetsConnection(serviceAccountJson, env.GOOGLE_SHEETS_ID);
    print(`   ✅ Connected! Sheet name: "${info.title}"`);
    print(`   Existing tabs: ${info.tabs.length > 0 ? info.tabs.join(', ') : '(none yet)'}`);

    // Create tabs
    print('\n📊 Setting up sheet tabs...');
    const { ensureAllTabs } = require('./sheets');
    await ensureAllTabs(serviceAccountJson, env.GOOGLE_SHEETS_ID);
    print('   ✅ All four tabs are ready: Daily Log, Food Rescue, Monthly Summary, Raw Log');
  } catch (err) {
    print('');
    print('   ❌ Could not connect to Google Sheets.');
    print(`   Error: ${err.message}`);
    print('');
    print('   Common fixes:');
    print('   - Make sure you shared the sheet with the service account email address');
    print('   - Double-check the GOOGLE_SHEETS_ID (copy it from the URL again)');
    print('   - Make sure the Google Sheets API is enabled in your Google Cloud project');
    print('');
    print('   Your credentials have been saved. Fix the issue and run `node setup.js` again.');
    rl.close();
    return;
  }

  // Done
  print('');
  hr();
  print('');
  print('🎉 Setup complete! Here\'s what to do next:');
  print('');
  print('  1. Test the full pipeline:');
  print('       node test.js');
  print('');
  print('  2. Deploy to Railway:');
  print('       - Push this folder to a GitHub repository');
  print('       - Go to railway.app, log in with GitHub, create a new project');
  print('       - Connect your GitHub repo and click Deploy');
  print('       - Add your environment variables in the Railway dashboard');
  print('       - Railway will give you a live URL like https://refettorio-bot.railway.app');
  print('');
  print('  3. Set your Twilio webhook:');
  print('       - Go to console.twilio.com → Messaging → WhatsApp Sandbox');
  print('       - In "When a message comes in", paste your Railway URL + /webhook');
  print('       - Example: https://refettorio-bot.railway.app/webhook');
  print('');
  print('  4. Send a test WhatsApp message to your Twilio sandbox number!');
  print('');

  rl.close();
}

main().catch((err) => {
  console.error('\n❌ Unexpected error during setup:', err.message);
  process.exit(1);
});
