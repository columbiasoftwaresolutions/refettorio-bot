# Refettorio Harlem — Guest Check-In App (Phase 2)

A tablet app for the front door. A volunteer checks in each guest as they walk in — name, zip code, dining in or takeaway, and age range. Each check-in takes under 15 seconds.

The data goes to the same Google Sheet used by the WhatsApp bot, in a new "Guest Log" tab.

---

## Setup (5 steps)

### Step 1 — Make sure Phase 1 is working

The check-in app runs on the same server as the WhatsApp bot. If the bot is already deployed on Railway, you're good — skip to Step 3.

If not, follow the main README to get the bot running first.

### Step 2 — Create the Guest Log tab

The server creates the "Guest Log" tab automatically on startup. Just restart the server (or redeploy on Railway) and the tab will appear in your Google Sheet.

### Step 3 — Open the app on the tablet

On the tablet's Chrome browser, go to:

```
https://YOUR-RAILWAY-URL.railway.app/checkin
```

Replace `YOUR-RAILWAY-URL` with your actual Railway URL.

Bookmark this page for easy access.

### Step 4 — Set up kiosk mode (Android tablet)

This locks the tablet to just the check-in screen so guests can't accidentally navigate away.

1. Open Chrome on the tablet
2. Go to your check-in URL
3. Tap the three dots menu (top right) → **Add to Home screen** → **Add**
4. Open the app from the home screen — it will run in full-screen mode

**For extra lockdown (optional):**
- Go to **Settings** → **Security** → **Screen pinning** → turn it on
- Open the check-in app from Recent Apps, tap the pin icon
- The tablet is now locked to this app until you enter your PIN

### Step 5 — Test it

1. Tap through a full check-in: enter a name, pick a zip, pick visit type, pick age
2. After the last tap, the screen flashes green and resets instantly
3. Check the Google Sheet — a new row should appear in the "Guest Log" tab

---

## How It Works

1. Volunteer taps through 4 questions for each guest (name → zip → visit type → age)
2. After the last selection, it auto-submits and resets — no confirm button needed
3. The guest count at the top updates with each check-in
4. If wifi drops, submissions queue automatically and sync when wifi returns
5. A "queued" indicator appears at the bottom if submissions are waiting to sync

---

## If Wifi Goes Out

Don't worry — the app keeps working. Submissions are saved on the tablet and sent to the Google Sheet automatically when wifi comes back. You'll see a red "Offline" banner at the top and a "queued" count at the bottom right.

Just keep checking in guests as normal.

---

## Changing the Zip Code Options

The zip codes are set directly in `checkin.html`. Look for the buttons that say `data-zip="10027"` etc. To change them:

1. Open `checkin.html` in a text editor
2. Find the zip code buttons (search for `data-zip`)
3. Change the numbers to whatever zip codes you need
4. Save the file and redeploy

---

## Google Sheet: Guest Log Tab

| Column | What it shows |
|---|---|
| Timestamp | When the check-in happened |
| Name | First name (or blank if skipped) |
| Zip Code | Selected zip code |
| Visit Type | "Dining In" or "Taking Away" |
| Age Range | "Under 18", "18-59", or "60+" |
