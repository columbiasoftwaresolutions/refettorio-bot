require('dotenv').config({ override: true });

// Only Google Sheets credentials are required (for check-in app)
// Twilio + Anthropic are optional (only needed for WhatsApp bot)
const required = [
  'GOOGLE_SHEETS_ID',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
];

function validate() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((k) => console.error(`   - ${k}`));
    console.error('\nRun `node setup.js` to configure your credentials.');
    process.exit(1);
  }

  // Validate Twilio SID format if provided
  if (process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    console.error('❌ TWILIO_ACCOUNT_SID must start with "AC".');
    process.exit(1);
  }

  // Parse the Google service account JSON
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Make sure you pasted the full contents of the key file.');
    process.exit(1);
  }

  return {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    sheets: {
      id: process.env.GOOGLE_SHEETS_ID,
      serviceAccount,
    },
  };
}

module.exports = { validate };
