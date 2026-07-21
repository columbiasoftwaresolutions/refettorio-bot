# Refettorio Harlem — Food Rescue Logging Bot

A messaging bot that lets kitchen staff at Refettorio Harlem log rescued meals in seconds, straight from their phones — no app, no training, just a text.

Built and maintained by [Columbia Software Solutions](https://github.com/columbiasoftwaresolutions). **Live in production**, logging 800+ meals per week.

## Why it exists
Refettorio Harlem rescues surplus food and serves free meals to the community. Tracking those meals by hand was slow and error-prone. This bot turns logging into a single message and writes clean, structured records the team can actually use.

## How it works
1. Staff send a message over WhatsApp (via Twilio)
2. The bot validates the input and parses the meal count and details
3. Records are appended to a Google Sheet the team already works in
4. Failed writes retry automatically; malformed messages get a friendly correction prompt

## Stack
- **Runtime:** Node.js
- **Messaging:** Twilio (WhatsApp)
- **Storage:** Google Sheets API
- **Hosting:** Vercel (migrated from Railway)

## Built for the real world
- Input validation and guided error messages for non-technical staff
- Automatic retries on transient API failures
- Guards against double-counting

---
*Part of Columbia Software Solutions' pro-bono work for NYC nonprofits.*
