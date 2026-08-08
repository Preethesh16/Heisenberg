// Thin Anthropic API caller shared by the four agents. No SDK — Node 18+ fetch,
// zero dependencies, so the agents run before anyone has npm-installed anything.

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_SONNET_MODEL = "claude-sonnet-4-5";
const configuredModel = process.env.ULTA_MODEL || DEFAULT_SONNET_MODEL;
export const CLAUDE_MODEL = configuredModel.toLowerCase().includes("sonnet")
  ? configuredModel
  : DEFAULT_SONNET_MODEL;
if (configuredModel !== CLAUDE_MODEL) {
  console.warn(`[agents] ULTA_MODEL must be a Sonnet model — using ${DEFAULT_SONNET_MODEL}`);
}
// A stalled provider must never freeze a debate turn — abort and let each
// agent's fallback run. 45s covers vision calls with margin.
const TIMEOUT_MS = Number(process.env.ULTA_TIMEOUT_MS) > 0 ? Number(process.env.ULTA_TIMEOUT_MS) : 45_000;

export async function callClaude({ system, messages, maxTokens = 1024 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Anthropic request timed out after ${TIMEOUT_MS}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Provider bodies can contain request details. Keep them out of logs and
    // client-facing fallback messages.
    throw new Error(`Anthropic API ${res.status}`);
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
