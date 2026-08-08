import { copy } from "../utils/copy";

// Semantic belief colours from ULTA-DESIGN §34 — they belong to the meter,
// never to the character.
function beliefColor(value) {
  if (value > 0.66) return "#E24B4A"; // belief held
  if (value > 0.33) return "#BA7517"; // belief slipping
  return "#639922"; // belief repaired
}

export default function BeliefMeter({ value }) {
  const pct = Math.round(value * 100);
  return (
    <div className="belief-meter">
      <div className="belief-meter__head">
        <span className="belief-meter__label">{copy.chintuPanel.beliefLabel}</span>
        <span className="belief-meter__pct">{pct}%</span>
      </div>
      <div
        className="belief-meter__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={copy.chintuPanel.beliefLabel}
      >
        <div
          className="belief-meter__fill"
          style={{ width: `${pct}%`, background: beliefColor(value) }}
        />
      </div>
    </div>
  );
}
