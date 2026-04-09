const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a data parser for Refettorio Harlem, a NYC nonprofit kitchen that serves free meals.
Your job is to read a staff message sent via WhatsApp after a meal service and extract structured data from it.

Return ONLY a valid JSON object — no explanation, no markdown, no extra text.

Rules:
- Extract every field you can find. Leave fields as null if they are not mentioned.
- "date" defaults to today's date (${new Date().toISOString().split('T')[0]}) if not stated.
- "meal_type" is "lunch" or "dinner" based on context clues. If unclear, null.
- If a demographic breakdown is given as percentages (e.g. "40% seniors"), compute counts using the total meals figure if available. If total is unknown, store the percentage value as a number and note uncertainty in clarification_needed.
- "confidence" is "high" if all numbers are clear; "low" if you had to guess or anything was ambiguous.
- "clarification_needed" is null if everything parsed cleanly, or a short plain-English question if something is unclear or seems wrong (e.g. totals don't add up, a number seems implausibly large).
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
