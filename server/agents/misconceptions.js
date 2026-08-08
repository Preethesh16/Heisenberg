// Loader for data/misconceptions/. Shared by all four agents so every one of
// them resolves IDs against the same library on disk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MISCONCEPTIONS_DIR = path.join(__dirname, "..", "..", "data", "misconceptions");

export const DEMO_DEFAULT_ID = "M-FRIC-04";

export function loadMisconceptions() {
  const byId = {};
  for (const file of fs.readdirSync(MISCONCEPTIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const m = JSON.parse(fs.readFileSync(path.join(MISCONCEPTIONS_DIR, file), "utf8"));
    byId[m.id] = m;
  }
  return byId;
}

// Resolve the misconception behind a session's diagnosis; unknown or missing
// IDs fall back to the demo default rather than erroring (CLAUDE.md failure table).
export function misconceptionForSession(session) {
  const byId = loadMisconceptions();
  const id = session?.diagnosis?.misconception_id;
  return byId[id] || byId[DEMO_DEFAULT_ID];
}

export function loadPrompt(name) {
  const template = fs.readFileSync(path.join(__dirname, "..", "..", "prompts", `${name}.md`), "utf8");
  // Everything above the first --- is maintainer notes, not prompt text.
  const cut = template.indexOf("\n---");
  return (cut === -1 ? template : template.slice(cut + 4)).trim();
}
