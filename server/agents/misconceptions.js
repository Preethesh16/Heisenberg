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

function dynamicFromDiagnosis(diagnosis) {
  if (!diagnosis?.dynamic || diagnosis?.diagnosable !== true) return null;
  const transferContexts = Array.isArray(diagnosis.transfer_contexts)
    ? diagnosis.transfer_contexts.filter((v) => typeof v === "string" && v.trim())
    : [];
  const required = [
    diagnosis.misconception_id,
    diagnosis.topic,
    diagnosis.concept,
    diagnosis.misconception,
    diagnosis.evidence,
    diagnosis.common_argument,
    diagnosis.repair_criteria,
    diagnosis.debate_problem,
    diagnosis.correct_model,
  ];
  if (required.some((v) => typeof v !== "string" || !v.trim()) || transferContexts.length < 2) return null;
  return {
    id: diagnosis.misconception_id,
    topic: diagnosis.topic,
    concept: diagnosis.concept,
    false_belief: diagnosis.misconception,
    observable_evidence: diagnosis.evidence,
    common_argument: diagnosis.common_argument,
    repair_criteria: diagnosis.repair_criteria,
    debate_problem: diagnosis.debate_problem,
    transfer_contexts: transferContexts,
    correct_model: diagnosis.correct_model,
    dynamic: true,
  };
}

// Resolve the concept package behind a session. Fixture sessions still use the
// authored three-item library; live sessions carry a validated package created
// from the uploaded work. Unknown live sessions never become friction.
export function misconceptionForSession(session) {
  const dynamic = dynamicFromDiagnosis(session?.diagnosis);
  if (dynamic) return dynamic;
  const byId = loadMisconceptions();
  const id = session?.diagnosis?.misconception_id;
  if (byId[id]) return byId[id];
  throw new Error("session has no usable diagnosis");
}

export function loadPrompt(name) {
  const template = fs.readFileSync(path.join(__dirname, "..", "..", "prompts", `${name}.md`), "utf8");
  // Everything above the first --- is maintainer notes, not prompt text.
  const cut = template.indexOf("\n---");
  return (cut === -1 ? template : template.slice(cut + 4)).trim();
}
