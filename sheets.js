const { google } = require('googleapis');

// Tab names
const TABS = {
  DAILY_LOG: 'Daily Log',
  FOOD_RESCUE: 'Food Rescue',
  MONTHLY_SUMMARY: 'Monthly Summary',
  RAW_LOG: 'Raw Log',
  GUEST_LOG: 'Guest Log',
  PANTRY_GUEST_LOG: 'Pantry Guest Log',
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
  [TABS.GUEST_LOG]: [
    'Timestamp', 'Name', 'Zip Code', 'Visit Type', 'Age Range', 'Meals', 'First Visit',
  ],
  [TABS.PANTRY_GUEST_LOG]: [
    'Timestamp', 'Name', 'Zip Code', 'Age Range', 'Bags', 'First Visit',
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

// Format a date/ISO string to readable "4/23/2026 2:30 PM" (Eastern Time)
function formatTimestamp(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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

// Append a restaurant guest check-in row
async function appendGuestLog(serviceAccount, spreadsheetId, { name, zipCode, visitType, ageRange, meals, firstVisit, timestamp }) {
  const sheetsClient = await getSheetsClient(serviceAccount);
  const ts = formatTimestamp(timestamp || new Date());
  const row = [ts, name || '', zipCode || '', visitType || '', ageRange || '', meals ?? 1, firstVisit ? 'Yes' : ''];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: `'${TABS.GUEST_LOG}'!A:G`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Append a pantry guest check-in row
async function appendPantryGuestLog(serviceAccount, spreadsheetId, { name, zipCode, ageRange, bags, firstVisit, timestamp }) {
  const sheetsClient = await getSheetsClient(serviceAccount);
  const ts = formatTimestamp(timestamp || new Date());
  const row = [ts, name || '', zipCode || '', ageRange || '', bags ?? 1, firstVisit ? 'Yes' : ''];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: `'${TABS.PANTRY_GUEST_LOG}'!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Append to both Guest Log and Pantry Guest Log (for "Both" mode)
async function appendBothLogs(serviceAccount, spreadsheetId, { name, zipCode, visitType, ageRange, meals, bags, firstVisit, timestamp }) {
  await appendGuestLog(serviceAccount, spreadsheetId, { name, zipCode, visitType, ageRange, meals, firstVisit, timestamp });
  await appendPantryGuestLog(serviceAccount, spreadsheetId, { name, zipCode, ageRange, bags, firstVisit, timestamp });
}

// Get today's guest count from the Guest Log tab
async function getGuestCountToday(serviceAccount, spreadsheetId) {
  const sheetsClient = await getSheetsClient(serviceAccount);
  const now = new Date();
  // Match today's date in "M/D/YYYY" format (Eastern Time)
  const todayStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

  try {
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TABS.GUEST_LOG}'!A:A`,
    });
    const rows = response.data.values || [];
    // Count rows where timestamp starts with today's date (skip header)
    return rows.slice(1).filter((r) => r[0] && r[0].startsWith(todayStr)).length;
  } catch {
    return 0;
  }
}

// Get unique guest names + zip codes from Guest Log (for autocomplete)
async function getGuestHistory(serviceAccount, spreadsheetId) {
  const sheetsClient = await getSheetsClient(serviceAccount);

  try {
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TABS.GUEST_LOG}'!B:C`, // Name, Zip Code columns
    });
    const rows = response.data.values || [];
    const guests = {};
    // Skip header, use most recent zip for each name
    for (const row of rows.slice(1)) {
      const name = (row[0] || '').trim();
      const zip = (row[1] || '').trim();
      if (name && name !== 'Anonymous Guest') {
        guests[name.toLowerCase()] = { name, zipCode: zip };
      }
    }
    return Object.values(guests);
  } catch {
    return [];
  }
}

module.exports = { ensureAllTabs, logService, logRaw, getSheetsClient, appendDailyLog, appendFoodRescue, appendRawLog, appendGuestLog, appendPantryGuestLog, appendBothLogs, getGuestCountToday, getGuestHistory, TABS };
