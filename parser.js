const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a data parser for Refettorio Harlem, a NYC nonprofit kitchen that serves free meals.
Your job is to read a staff message sent via WhatsApp after a meal service and extract structured data from it.

Return ONLY a valid JSON object — no explanation, no markdown, no extra text.

Rules:
- Extract every field you can find. Leave fields as null if they are not mentioned.
- "date" defaults to today's date (${new Date().toISOString().split('T')[0]}) if not stated.
- "meal_type" is "lunch" or "dinner" based on context clues. If unclear, null.
- If a demographic breakdown is given as percentages (e.g. "40% seniors"), compute counts using the total meals figure if available. If total is unknown, store the percentage as a number.
- IMPORTANT: These messages come from busy kitchen staff on their phones. Approximate language is NORMAL and expected. Words like "about", "roughly", "maybe", "around", "like", "approximately", "give or take" should be treated as exact numbers — just use the number they gave. Do NOT ask for clarification on approximate numbers. Do NOT set confidence to "low" because of approximate language.
- When staff give a range or two options like "15 or 14", "maybe 95 or 100", "between 80 and 90" — just pick the first number. Never drop the field because two numbers were given.
- Voice-to-text often misspells names. "Boulder" means "Baldor". Interpret phonetic misspellings generously.
- "confidence" should be "high" in almost all cases. Only set it to "low" if the message is truly incoherent or contradictory (e.g. "we served 50 total but 40 sitdown and 30 takeaway").
- "clarification_needed" should be null in almost all cases. Only set it if something is genuinely contradictory or impossible to parse. Never ask for clarification about approximate numbers, missing fields, or informal language.
- "logged_by" should be set to the phone number or name provided — leave it blank here, it will be filled by the server.

Return this exact JSON shape:
{
  "date": "YYYY-MM-DD",
  "meal_type": "lunch" | "dinner" | null,
  "food_rescue": {
    "baldor_lbs": number | null,
    "baldor_value_usd": number | null,
    "other_sources": [{ "name": string, "lbs": number | null, "value_usd": number | null }],
    "ingredient_budget_usd": number | null
  },
  "meals_served": {
    "sitdown": number | null,
    "takeaway": number | null,
    "total": number | null,
    "adults": number | null,
    "children": number | null,
    "seniors": number | null
  },
  "pantry": {
    "bags_distributed": number | null,
    "avg_bag_weight_lbs": number | null,
    "pantry_guests": number | null
  },
  "kitchen": {
    "meal_requests": number | null,
    "avg_plate_weight_lbs": number | null
  },
  "confidence": "high" | "low",
  "clarification_needed": null | "string explaining what's unclear",
  "logged_by": ""
}`;

async function parseMessage(rawText, apiKey) {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: rawText,
      },
    ],
  });

  const content = response.content[0].text.trim();

  // Strip markdown code fences if Claude wrapped the JSON
  const jsonText = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Claude returned non-JSON output: ${content}`);
  }

  return parsed;
}

module.exports = { parseMessage };
