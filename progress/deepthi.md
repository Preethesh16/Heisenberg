# Progress — Deepthi · feat/agents

### T+0:45 · feat/agents · d7eebeb
**Did:** M-FRIC-04.json written in full against CONTRACTS §4. Diagnosis agent returns the exact CONTRACTS §2 shape; misconception_id validated against data/misconceptions/, confidence < 0.6 or unknown ID degrades to UNKNOWN.
**Files:** data/misconceptions/M-FRIC-04.json, prompts/diagnose.md, server/agents/claude.js, server/agents/diagnose.js
**Decided:** Agents call the Anthropic API with Node's built-in fetch, no SDK — zero dependencies means no root package.json, which sits outside my folders. Also: topic and correct_model are rebuilt from the matched misconception file, not taken from the model's reply, so library text can never drift.
**Blocked:** Partially — no ANTHROPIC_API_KEY in this environment, so testing is structural (schema, validation, no-key degradation) rather than live photo tests. Live vision test needed when a key is available; flag at Sync 1.
**Next:** Chintu agent with strict payload isolation.

### T+1:15 · feat/agents · b74bf3b
**Did:** Chintu agent. Payload built field by field via buildChintuPayload — exactly {misconception, common_argument, problem} plus history as messages. Isolation test simulates a careless caller spreading the whole misconception file plus judge output at him; confirms correct_model, repair_criteria, and judge text never reach the prompt. Emotion/gesture validated against the contract enums; invalid emotion falls back to stubborn, staying in character.
**Files:** prompts/chintu.md, server/agents/chintu.js, server/agents/isolation-test.js
**Decided:** API failure returns an in-character confused line ("say that again?") with belief unchanged, never an error — a crashed Chintu breaking character would be worse than a lost turn. Yield is gated in the prompt: belief below 0.3 AND no comeback left, stepping through confused → surprised → convinced, so he can't fold to keywords.
**Blocked:** Same as before — no API key, so adversarial "trick him into being helpful" testing waits for a key. Isolation boundary is verified structurally.
**Next:** Judge agent — must fail keyword-only answers.

### T+1:50 · feat/agents · 1e9d7f2
**Did:** Judge and Verifier. Judge returns the CONTRACTS §2 shape with clamped scores and tone. Tested the required case: "because relative motion" returns passed: false even when a stubbed generous model says pass — verified with a stub since there's no API key. Verifier picks a transfer_context different from the debate context and degrades to a canned M-FRIC-04 transfer problem if the API is down.
**Files:** prompts/judge.md, prompts/verify.md, server/agents/judge.js, server/agents/verify.js
**Decided:** The keyword rule is enforced twice — in the prompt AND a code gate (a pass with empty repair_evidence or under 8 words downgrades to fail). Prompts alone drift under pressure; the gate makes the demo-critical behaviour deterministic. Judge outage returns passed: false with "continue the debate", because a wrongly-passed session is worse than one extra debate turn.
**Blocked:** No.
**Next:** M-NEWT-03 and M-NEWT-07 misconception files, then push.
