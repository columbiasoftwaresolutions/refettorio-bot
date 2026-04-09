const { google } = require('googleapis');

// Tab names
const TABS = {
  DAILY_LOG: 'Daily Log',
  FOOD_RESCUE: 'Food Rescue',
  MONTHLY_SUMMARY: 'Monthly Summary',
  RAW_LOG: 'Raw Log',
};

// Headers for each tab
const HEADERS = {
  [TABS.DAILY_LOG]: [
    'Date', 'Meal Type', 'Sit-Down', 'Takeaway', 'Total Meals',
    'Adults', 'Children', 'Seniors',
    'Pantry Bags', 'Avg Bag Weight (lbs)', 'Pantry Guests',
    'Meal Requests', 'Avg Plate Weight (lbs)',
    'Ingredient Budget ($)', 'Logged By', 'Timestamp',
  ],
  [TABS.FOOD_RESCUE]: [
    'Date', 'Source', 'Weight (lbs)', 'Est. Value ($)', 'Logged By', 'Timestamp',
  ],
  [TABS.MONTHLY_SUMMARY]: [
    'Month', 'Total Meals', 'Total Food Rescued (lbs)', 'Total Est. Rescue Value ($)',
    'Total Pantry Bags', 'Total Pantry Guests',
  ],
  [TABS.RAW_LOG]: [
    'Timestamp', 'Phone Number', 'Raw Message', 'Parsed Successfully (Y/N)', 'Notes',
  ],
};

// ARRAYFORMULA-based monthly summary rows
function monthlySummaryFormulas(sheetsId) {
  return [
    [
      '=TEXT(DATEVALUE("1/"&ROW()-1&"/"&YEAR(TODAY())),"MMMM YYYY")',
      "=SUMPRODUCT((TEXT(DATEVALUE('Daily Log'!A2:A1000),\"YYYY-MM\")=TEXT(DATE(YEAR(TODAY()),ROW()-1,1),\"YYYY-MM\"))*IF(ISNUMBER('Daily Log'!E2:E1000),'Daily Log'!E2:E1000,0))",
      "=SUMPRODUCT((TEXT(DATEVALUE('Food Rescue'!A2:A1000),\"YYYY-MM\")=TEXT(DATE(YEAR(TODAY()),ROW()-1,1),\"YYYY-MM\"))*IF(ISNUMBER('Food Rescue'!C2:C1000),'Food Rescue'!C2:C1000,0))",
      "=SUMPRODUCT((TEXT(DATEVALUE('Food Rescue'!A2:A1000),\"YYYY-MM\")=TEXT(DATE(YEAR(TODAY()),ROW()-1,1),\"YYYY-MM\"))*IF(ISNUMBER('Food Rescue'!D2:D1000),'Food Rescue'!D2:D1000,0))",
      "=SUMPRODUCT((TEXT(DATEVALUE('Daily Log'!A2:A1000),\"YYYY-MM\")=TEXT(DATE(YEAR(TODAY()),ROW()-1,1),\"YYYY-MM\"))*IF(ISNUMBER('Daily Log'!I2:I1000),'Daily Log'!I2:I1000,0))",
      "=SUMPRODUCT((TEXT(DATEVALUE('Daily Log'!A2:A1000),\"YYYY-MM\")=TEXT(DATE(YEAR(TODAY()),ROW()-1,1),\"YYYY-MM\"))*IF(ISNUMBER('Daily Log'!K2:K1000),'Daily Log'!K2:K1000,0))",
    ],
  ];
}

function getAuth(serviceAccount) {
  return new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetsClient(serviceAccount) {
  const auth = getAuth(serviceAccount);
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

// Get existing sheet tab titles
async function getExistingTabs(sheetsClient, spreadsheetId) {
  const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
  return meta.data.sheets.map((s) => s.properties.title);
}

// Create a tab with headers if it doesn't exist
async function ensureTab(sheetsClient, spreadsheetId, tabName, existingTabs) {
  if (existingTabs.includes(tabName)) return;

  // Add the sheet
  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });

  // Write headers
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADERS[tabName]] },
  });

  // For Monthly Summary, add 12 rows of formula stubs
  if (tabName === TABS.MONTHLY_SUMMARY) {
    const rows = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i + 1;
      return [
        `=TEXT(DATE(YEAR(TODAY()),${monthIndex},1),"MMMM YYYY")`,
        `=SUMPRODUCT((TEXT(DATEVALUE('Daily Log'!A$2:A$1000),"YYYY-MM")=TEXT(DATE(YEAR(TODAY()),${monthIndex},1),"YYYY-MM"))*IF(ISNUMBER('Daily Log'!E$2:E$1000),'Daily Log'!E$2:E$1000,0))`,
        `=SUMPRODUCT((TEXT(DATEVALUE('Food Rescue'!A$2:A$1000),"YYYY-MM")=TEXT(DATE(YEAR(TODAY()),${monthIndex},1),"YYYY-MM"))*IF(ISNUMBER('Food Rescue'!C$2:C$1000),'Food Rescue'!C$2:C$1000,0))`,
        `=SUMPRODUCT((TEXT(DATEVALUE('Food Rescue'!A$2:A$1000),"YYYY-MM")=TEXT(DATE(YEAR(TODAY()),${monthIndex},1),"YYYY-MM"))*IF(ISNUMBER('Food Rescue'!D$2:D$1000),'Food Rescue'!D$2:D$1000,0))`,
        `=SUMPRODUCT((TEXT(DATEVALUE('Daily Log'!A$2:A$1000),"YYYY-MM")=TEXT(DATE(YEAR(TODAY()),${monthIndex},1),"YYYY-MM"))*IF(ISNUMBER('Daily Log'!I$2:I$1000),'Daily Log'!I$2:I$1000,0))`,
        `=SUMPRODUCT((TEXT(DATEVALUE('Daily Log'!A$2:A$1000),"YYYY-MM")=TEXT(DATE(YEAR(TODAY()),${monthIndex},1),"YYYY-MM"))*IF(ISNUMBER('Daily Log'!K$2:K$1000),'Daily Log'!K$2:K$1000,0))`,
      ];
    });

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'${TABS.MONTHLY_SUMMARY}'!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
  }
}

// Ensure all four tabs exist (called on startup and by setup.js)
async function ensureAllTabs(serviceAccount, spreadsheetId) {
  const sheetsClient = await getSheetsClient(serviceAccount);
  const existing = await getExistingTabs(sheetsClient, spreadsheetId);

  for (const tabName of Object.values(TABS)) {
    await ensureTab(sheetsClient, spreadsheetId, tabName, existing);
  }
}

// Append a row to the Daily Log tab
async function appendDailyLog(sheetsClient, spreadsheetId, parsed, loggedBy) {
  const ms = parsed.meals_served || {};
  const p = parsed.pantry || {};
  const k = parsed.kitchen || {};
  const fr = parsed.food_rescue || {};
  const timestamp = new Date().toISOString();

  const row = [
    parsed.date,
    parsed.meal_type || '',
    ms.sitdown ?? '',
    ms.takeaway ?? '',
    ms.total ?? '',
    ms.adults ?? '',
    ms.children ?? '',
    ms.seniors ?? '',
    p.bags_distributed ?? '',
    p.avg_bag_weight_lbs ?? '',
    p.pantry_guests ?? '',
    k.meal_requests ?? '',
    k.avg_plate_weight_lbs ?? '',
    fr.ingredient_budget_usd ?? '',
    loggedBy,
    timestamp,
  ];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: `'${TABS.DAILY_LOG}'!A:P`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Append rows to the Food Rescue tab (one per source)
async function appendFoodRescue(sheetsClient, spreadsheetId, parsed, loggedBy) {
  const fr = parsed.food_rescue || {};
  const timestamp = new Date().toISOString();
  const rows = [];

  if (fr.baldor_lbs != null || fr.baldor_value_usd != null) {
    rows.push([
      parsed.date,
      'Baldor',
      fr.baldor_lbs ?? '',
      fr.baldor_value_usd ?? '',
      loggedBy,
      timestamp,
    ]);
  }

  for (const source of fr.other_sources || []) {
    rows.push([
      parsed.date,
      source.name || 'Unknown',
      source.lbs ?? '',
      source.value_usd ?? '',
      loggedBy,
      timestamp,
    ]);
  }

  if (rows.length === 0) return;

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: `'${TABS.FOOD_RESCUE}'!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

// Append to the Raw Log tab
async function appendRawLog(sheetsClient, spreadsheetId, { phoneNumber, rawMessage, parsedOk, notes }) {
  const timestamp = new Date().toISOString();
  const row = [timestamp, phoneNumber, rawMessage, parsedOk ? 'Y' : 'N', notes || ''];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: `'${TABS.RAW_LOG}'!A:E`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Main entry point: log a fully parsed message
async function logService(serviceAccount, spreadsheetId, parsed, loggedBy) {
  const sheetsClient = await getSheetsClient(serviceAccount);

  await appendDailyLog(sheetsClient, spreadsheetId, parsed, loggedBy);
  await appendFoodRescue(sheetsClient, spreadsheetId, parsed, loggedBy);
  await appendRawLog(sheetsClient, spreadsheetId, {
    phoneNumber: loggedBy,
    rawMessage: '[parsed message]',
    parsedOk: true,
    notes: '',
  });
}

// Log a raw message that failed parsing or needed clarification
async function logRaw(serviceAccount, spreadsheetId, { phoneNumber, rawMessage, parsedOk, notes }) {
  const sheetsClient = await getSheetsClient(serviceAccount);
  await appendRawLog(sheetsClient, spreadsheetId, { phoneNumber, rawMessage, parsedOk, notes });
}

module.exports = { ensureAllTabs, logService, logRaw, getSheetsClient, appendDailyLog, appendFoodRescue, appendRawLog, TABS };
