# Refettorio Bot — Developer Deployment Guide

This is the step-by-step guide for setting up the bot under Refettorio's own accounts.
You do all of this — they never touch a terminal.

Estimated time: 1–2 hours the first time, 20 minutes if you've done it before.

---

## Before You Start

You'll need either:
- Screen share access with someone from Refettorio who can log into their accounts, OR
- Their account credentials sent to you securely (use a password manager or Signal, not email)

You'll be setting up 4 services. Do them in this order.

---

## Step 1 — Google Sheet + Service Account (~20 min)

This is the most involved step. Do it first.

### 1A. Create the Google Sheet

1. Log into Refettorio's Google account
2. Go to sheets.google.com → create a new blank sheet
3. Name it **"Refettorio Meal Log"**
4. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`)
5. Save it — you'll need it in Step 5

### 1B. Create the Google Cloud service account

1. Go to console.cloud.google.com (logged in as Refettorio)
2. Click the project dropdown at the top → **New Project** → name it `refettorio-bot` → **Create**
3. Make sure the new project is selected in the dropdown
4. Search for **Google Sheets API** → click it → click **Enable**
5. Go to **IAM & Admin** → **Service Accounts** → **+ Create Service Account**
6. Name it `refettorio-bot` → **Create and Continue** → skip optional steps → **Done**
7. Click the service account you just created
8. Go to **Keys** tab → **Add Key** → **Create new key** → **JSON** → **Create**
9. A `.json` file downloads — keep this, you'll need it in Step 5

### 1C. Share the sheet with the service account

1. Open the downloaded `.json` file in a text editor
2. Find the `"client_email"` line — copy that email address
   (looks like `refettorio-bot@refettorio-bot.iam.gserviceaccount.com`)
3. Go back to the Google Sheet → **Share**
4. Paste the email → set to **Editor** → uncheck "Notify people" → **Share**

---

## Step 2 — Twilio (~15 min)

### 2A. Create the account

1. Go to twilio.com → sign up with Refettorio's email
2. Verify the phone number when prompted

### 2B. Get credentials

1. On the Twilio dashboard, copy:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (click the eye icon to reveal)
2. Save both — you'll need them in Step 5

### 2C. Set up WhatsApp

**For testing (sandbox — free, works immediately):**
1. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Note the sandbox number shown — staff text this to test
3. Staff need to send the join code once (e.g. `join apple-mango`) to activate

**For production (real WhatsApp number — do this in parallel, takes 3–5 days):**
1. Go to **Messaging** → **Senders** → **WhatsApp Senders** → **Add Sender**
2. Follow Twilio's Meta approval process
3. You'll need Refettorio's legal name, address, and a Facebook Business account
4. Once approved, use this number instead of the sandbox number
5. Update `TWILIO_WHATSAPP_NUMBER` in Railway (Step 4) when approved

---

## Step 3 — Anthropic (~5 min)

1. Go to console.anthropic.com → sign up with Refettorio's email
2. Go to **Billing** → add a credit card → add $10 credit to start
3. Go to **API Keys** → **Create Key** → name it `refettorio-bot`
4. Copy the key (starts with `sk-ant-`) — save it for Step 5

---

## Step 4 — Railway (~15 min)

### 4A. Create the account

1. Go to railway.app → **Sign in with GitHub**
2. Use the Columbia Software Solutions GitHub account (or transfer the repo to Refettorio's GitHub first)

### 4B. Deploy the bot

1. Click **New Project** → **Deploy from GitHub repo**
2. Select `refettorio-bot`
3. Click **Deploy Now** — Railway will build and start the bot
4. Wait for the deployment to show as **Active**

### 4C. Add environment variables

1. Click on your project → **Variables** tab
2. Add each of these one by one:

| Variable | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | From Step 2B |
| `TWILIO_AUTH_TOKEN` | From Step 2B |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+14155238886` (sandbox) or their real number |
| `ANTHROPIC_API_KEY` | From Step 3 |
| `GOOGLE_SHEETS_ID` | From Step 1A |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste the entire contents of the `.json` file from Step 1B |

For `GOOGLE_SERVICE_ACCOUNT_JSON`: open the `.json` file, select all, copy, paste as the value. Railway handles multi-line values fine.

3. Railway will automatically redeploy after you save variables

### 4D. Get the live URL

1. Go to **Settings** → **Domains** → **Generate Domain**
2. Copy the URL — looks like `https://refettorio-bot-production.up.railway.app`
3. Save it for Step 5

---

## Step 5 — Set the Twilio Webhook (~2 min)

1. Go to the Twilio console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Scroll to **Sandbox Settings**
3. In **"When a message comes in"** paste:
   ```
   https://YOUR-RAILWAY-URL.railway.app/webhook
   ```
4. Make sure method is **HTTP POST**
5. Click **Save**

---

## Step 6 — Test It

### Run the automated test (from your laptop)
Make sure your local `.env` has Refettorio's credentials, then:
```
node test.js
```
All 8 tests should pass.

### Send a real WhatsApp message
1. Text the Twilio sandbox number from your phone
2. Send the join code first (one time only)
3. Send: `Tonight we served 50 sit-down meals, 10 takeaway, Baldor was 100 lbs`
4. You should get a reply within a few seconds
5. Check the Google Sheet — a row should appear in Daily Log and Food Rescue

---

## Step 7 — Hand Off to Refettorio

Once everything is working, give them:

1. **The WhatsApp number** to save in their phones and share with kitchen staff
2. **The Google Sheet link** — share it with whoever needs to view the data
3. **The sample messages cheat sheet** (below) — print it or put it in their staff WhatsApp group

### Sample messages cheat sheet (print this for staff)

```
Text the bot after every service. Just write naturally — examples:

Meals only:
"Tonight we served 87 sit-down meals, 23 takeaway"

With demographics:
"Dinner: 102 total, 15 kids, 30 seniors, rest adults"

With food rescue:
"Baldor drop was 200 lbs, maybe $400 value"
"City Harvest dropped 60 lbs"

With pantry:
"Pantry had 45 guests, 38 bags, avg 8 lbs each"

Full service log:
"Tonight we served 87 sit-down, 23 takeaway, 40% seniors,
Baldor was 200 lbs, pantry had 45 guests, 38 bags"

Budget:
"Ingredient budget was $80 tonight"
```

---

## Ongoing Maintenance

**If something breaks:**
- Check Railway logs: railway.app → your project → **Deployments** → click the active deployment → **Logs**
- Most issues are credential-related (expired key, sheet permission removed)

**If a credential needs updating:**
- Go to Railway → **Variables** → update the value → Railway auto-redeploys

**If you update the code:**
- Push to GitHub → Railway auto-redeploys within ~1 minute

**Monthly cost estimate:**
- Railway: $0 (free hobby tier)
- Twilio: ~$1/mo (WhatsApp number fee, after sandbox)
- Anthropic: ~$1–2/mo at Refettorio's volume
- Google Cloud: $0

---

## Troubleshooting

**Bot not responding to WhatsApp messages**
- Check the Railway deployment is active (green) in the dashboard
- Confirm the Twilio webhook URL ends in `/webhook` with no trailing slash
- Check Railway logs for errors

**"Permission denied" from Google Sheets**
- The service account email was not added as Editor to the sheet
- Re-share the sheet (Step 1C) and make sure it's Editor, not Viewer

**Claude API 401 error in logs**
- Anthropic key is invalid or has no credit
- Generate a new key at console.anthropic.com and update it in Railway Variables

**Sheet tabs missing**
- Restart the Railway deployment — the bot creates tabs on startup
- Or run `node setup.js` locally with their credentials

**Messages logging but wrong data**
- Check the Raw Log tab — the original message is always saved there
- The bot will ask for clarification if something is ambiguous
