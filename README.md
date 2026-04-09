# Refettorio Harlem — WhatsApp Meal Logging Bot

A WhatsApp bot that lets kitchen staff log each dinner service in under 3 minutes, from their phone. Staff text the bot naturally — the bot parses the message automatically and logs it to a Google Sheet.

**Example message the bot handles:**
> "Tonight we served 87 sit-down meals, 23 takeaway, about 40% seniors, Baldor drop was 200 lbs"

The bot reads that, pulls out all the numbers, and logs them to the right columns in your Google Sheet — no typing into forms, no spreadsheet access needed.

---

## Before You Start

You will need accounts at these services. All have free tiers that are more than enough for this use case:

| Service | What it's for | Cost |
|---|---|---|
| Twilio | Sends/receives WhatsApp messages | Free sandbox for testing; ~$1/mo to go live |
| Anthropic | AI that reads staff messages | Pay-per-use, roughly pennies per message |
| Google Cloud | Connects the bot to your Google Sheet | Free |
| Railway | Runs the bot 24/7 on the internet | Free hobby tier |
| GitHub | Stores your code (Railway needs this) | Free |

---

## Step 1 — Get Your Credentials

You'll need 6 pieces of information before running setup. Here's exactly where to find each one.

---

### 1A. Twilio Account SID and Auth Token

1. Go to [console.twilio.com](https://console.twilio.com) and create a free account (or log in).
2. On the main dashboard, you'll see your **Account SID** and **Auth Token**. The Account SID starts with `AC`.
3. Click the eye icon next to Auth Token to reveal it.
4. Copy both values — you'll need them in a moment.

---

### 1B. Twilio WhatsApp Sandbox Number

1. In the Twilio console, go to **Messaging** → **Try it out** → **Send a WhatsApp Message**.
2. You'll see a phone number like `+1 415 523 8886`. This is your sandbox number.
3. Note it down as: `whatsapp:+14155238886` (no spaces, with the `whatsapp:` prefix).
4. To test, your staff will need to send "join [two-word code]" to this number once to join the sandbox.

---

### 1C. Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) and create a free account (or log in).
2. Click **API Keys** in the left sidebar.
3. Click **Create Key**, give it a name like "refettorio-bot", and copy the key.
4. The key starts with `sk-ant-`.

> **Note:** You'll need to add a small amount of credit ($5–10) to your Anthropic account for the API to work. Each message costs a fraction of a cent.

---

### 1D. Google Sheet ID

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it something like "Refettorio Meal Log".
3. Look at the URL in your browser. It looks like this:
   ```
   https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
   ```
4. Copy the long string between `/d/` and `/edit`. In the example above, that's:
   ```
   1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
   ```
   That's your Sheet ID.

---

### 1E. Google Service Account (the most involved step — follow carefully)

This lets the bot write to your Google Sheet automatically. You're creating a "robot user" that has permission to edit the sheet.

**Part 1: Create the service account**

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. At the top, click the project selector and click **New Project**. Name it "refettorio-bot" and click **Create**.
3. Make sure your new project is selected in the dropdown at the top.
4. In the search bar, type **Google Sheets API** and click on it.
5. Click the blue **Enable** button.
6. In the left menu, go to **IAM & Admin** → **Service Accounts**.
7. Click **+ Create Service Account**.
8. For "Service account name", type `refettorio-bot`. Click **Create and Continue**.
9. Skip the next two optional steps — just click **Continue** and then **Done**.

**Part 2: Download the key file**

10. You should now see your service account in the list. Click on it.
11. Go to the **Keys** tab.
12. Click **Add Key** → **Create new key**.
13. Select **JSON** and click **Create**.
14. A `.json` file will automatically download to your computer. Keep this file safe — it's like a password.

**Part 3: Share your Google Sheet with the service account**

15. Open the `.json` file you just downloaded in a text editor (Notepad, TextEdit, etc.).
16. Find the line that says `"client_email"`. Copy the email address — it looks like:
    ```
    refettorio-bot@your-project-name.iam.gserviceaccount.com
    ```
17. Go back to your Google Sheet.
18. Click the **Share** button (top right).
19. Paste that email address into the "Add people and groups" field.
20. Make sure the permission is set to **Editor**.
21. Uncheck "Notify people" (the bot doesn't need an email).
22. Click **Share**.

You're ready to run setup.

---

## Step 2 — Run the Setup Wizard

Open a terminal in the project folder and run:

```
node setup.js
```

The wizard will ask you for each credential one at a time, with plain-English instructions. It will:
- Validate each credential as you enter it
- Save everything to a `.env` file
- Connect to your Google Sheet and create the four tabs automatically

If anything goes wrong, the wizard will tell you exactly what to fix.

---

## Step 3 — Deploy to Railway

Railway runs your bot 24/7 on the internet so it can receive WhatsApp messages.

1. **Push your code to GitHub**
   - Create a new repository at [github.com](https://github.com) (make it private if you prefer).
   - In the terminal, run:
     ```
     git remote add origin https://github.com/YOUR_USERNAME/refettorio-bot.git
     git push -u origin main
     ```

2. **Create a Railway account**
   - Go to [railway.app](https://railway.app) and sign in with GitHub.

3. **Create a new project**
   - Click **New Project** → **Deploy from GitHub repo**.
   - Select your `refettorio-bot` repository.
   - Click **Deploy Now**.

4. **Add your environment variables**
   - In Railway, click on your project → **Variables** tab.
   - Add each of these, using the same values from your `.env` file:
     ```
     TWILIO_ACCOUNT_SID
     TWILIO_AUTH_TOKEN
     TWILIO_WHATSAPP_NUMBER
     ANTHROPIC_API_KEY
     GOOGLE_SHEETS_ID
     GOOGLE_SERVICE_ACCOUNT_JSON
     ```
   - For `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the entire contents of your JSON key file as one value.

5. **Get your live URL**
   - Railway will show you a URL like `https://refettorio-bot-production.up.railway.app`.
   - Copy this URL — you'll need it in the next step.

---

## Step 4 — Set the Twilio Webhook

This tells Twilio to send incoming WhatsApp messages to your bot.

1. Go to the [Twilio Console](https://console.twilio.com).
2. Navigate to **Messaging** → **Try it out** → **Send a WhatsApp Message**.
3. Scroll down to the **Sandbox Settings** section.
4. In the field labeled **"When a message comes in"**, paste your Railway URL followed by `/webhook`:
   ```
   https://refettorio-bot-production.up.railway.app/webhook
   ```
5. Make sure the method dropdown says **HTTP POST**.
6. Click **Save**.

---

## Step 5 — Run the Test Script

Before using the bot live, run the automated test to confirm everything works end-to-end:

```
node test.js
```

This will:
1. Send 3 sample messages through the parser and show you what data was extracted
2. Write test rows to each tab in your Google Sheet
3. Print PASS or FAIL for each step

If all tests pass, you'll see: `🎉 All tests passed! The bot is ready to use.`

---

## Step 6 — Send a Real Test WhatsApp Message

1. On your phone, open WhatsApp and message the Twilio sandbox number.
2. First, send the join code (something like `join apple-mango`) — you only need to do this once.
3. Then send a test message like:
   > "Tonight we served 50 sit-down meals, 10 takeaway, Baldor was 100 lbs"
4. The bot should reply within a few seconds with a confirmation.
5. Open your Google Sheet and confirm the data appeared in the Daily Log and Food Rescue tabs.

---

## How Staff Use the Bot

Staff can text the bot naturally during or after a service. They do not need to use any special format. Examples:

- `"Tonight we served 87 sit-down meals, 23 takeaway, about 40% seniors, Baldor drop was 200 lbs"`
- `"Dinner: 102 total, 15 kids, 30 seniors, rest adults. Pantry had 45 guests, 38 bags at around 8 lbs each"`
- `"Got a Baldor delivery — roughly 150 lbs, maybe $300 value. Also City Harvest dropped 60 lbs"`
- `"Budget was about $80 tonight. Served 65 sit-down, no takeaway"`

The bot will reply with a confirmation and a one-line summary of what was logged.

---

## The Google Sheet

The bot automatically maintains four tabs:

| Tab | What's in it |
|---|---|
| **Daily Log** | One row per service — meals, pantry, demographics, budget |
| **Food Rescue** | One row per food source per service — Baldor, City Harvest, etc. |
| **Monthly Summary** | Auto-calculated totals by month (no manual work needed) |
| **Raw Log** | Every message the bot received, for audit purposes |

---

## Troubleshooting

**The bot isn't receiving messages**
- Check that the Twilio webhook URL is correct (ends in `/webhook`, no trailing slash)
- Make sure your Railway deployment is running (check the Railway dashboard for errors)
- Confirm the method is set to HTTP POST in Twilio sandbox settings

**"Permission denied" error in Google Sheets**
- The service account was not added as an editor to the sheet
- Go back to Step 1E, Part 3 — find the `client_email` in your JSON key file and share the sheet with that address
- Make sure you set the permission to **Editor**, not just Viewer

**Claude API errors / messages aren't being parsed**
- Your Anthropic API key may be invalid or have no credit
- Go to [console.anthropic.com](https://console.anthropic.com), check your API key, and add credit if needed
- Run `node test.js` to confirm the key works

**Messages are logging but some tabs are missing**
- Run `node setup.js` again — it will recreate any missing tabs without affecting existing data

**The bot replies but numbers look wrong**
- The bot will sometimes ask for clarification if a message is ambiguous
- Encourage staff to be specific: "87 sit-down" is clearer than "about 87 or so"
- The Raw Log tab has the original message for every submission so you can always check what was sent

**The bot replies "I had trouble saving"**
- Usually a Google Sheets connection issue
- Check Railway logs for the full error message
- Most common cause: the service account email was removed from the sheet, or the Sheet ID changed

---

## Project Files

| File | What it does |
|---|---|
| `index.js` | The web server that receives WhatsApp messages from Twilio |
| `parser.js` | Sends the message to Claude and gets back structured data |
| `sheets.js` | Writes data to the Google Sheet |
| `config.js` | Loads and checks your credentials |
| `setup.js` | Interactive setup wizard — run once |
| `test.js` | Automated test script |
| `.env` | Your credentials — never share or commit this file |
| `.env.example` | Template showing what goes in `.env` |
