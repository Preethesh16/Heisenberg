import { copy } from "../utils/copy";

// Gets the id and the false belief only. The correct model never renders
// here — the whole session exists because the student has to produce it.
export default function MisconceptionCard({ misconceptionId, misconception, topic, concept }) {
  return (
    <section className="misconception-card">
      <div className="misconception-card__meta">
        <span className="misconception-card__id">{misconceptionId}</span>
        <span className="misconception-card__topic">{concept || topic}</span>
      </div>
      <div>
        <span className="misconception-card__label">{copy.misconceptionCard.label}</span>
        <p className="misconception-card__belief">{misconception}</p>
      </div>
    </section>
  );
}
