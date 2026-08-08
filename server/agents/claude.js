// Thin Anthropic API caller shared by the four agents. No SDK — Node 18+ fetch,
// zero dependencies, so the agents run before anyone has npm-installed anything.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ULTA_MODEL || "claude-sonnet-4-5";

export async function callClaude({ system, messages, maxTokens = 1024 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

// Agents ask for bare JSON, but models sometimes wrap it anyway — strip fences
// and any prose around the outermost object rather than failing the session.
export function parseJson(text) {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON object in response: ${text.slice(0, 120)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}
