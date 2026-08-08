import { copy } from "../utils/copy";

// Diagnosed → Teaching → Judge → Transfer. Maps the six-value Stage enum onto
// the four steps a viewer needs to see.
const STAGE_INDEX = {
  upload: 0,
  diagnosing: 0,
  debate: 1,
  judging: 2,
  transfer: 3,
  done: 4,
};

export default function StageRail({ stage }) {
  const current = STAGE_INDEX[stage] ?? 0;
  return (
    <nav className="stage-rail" aria-label="Session stages">
      {copy.stageRail.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <span key={label} className={`stage-rail__step stage-rail__step--${state}`}>
            <span className="stage-rail__dot">{state === "done" ? "✓" : state === "current" ? "●" : "○"}</span>
            {label}
          </span>
        );
      })}
    </nav>
  );
}
