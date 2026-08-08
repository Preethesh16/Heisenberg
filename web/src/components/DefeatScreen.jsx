import { useEffect, useState } from "react";
import Chintu from "./Chintu";
import TeacherDashboardPreview from "./TeacherDashboardPreview";
import { copy } from "../utils/copy";

// ULTA-DESIGN §37. Bars animate old → new in sequence — SPOT last, because
// the SPOT jump is the number no other product can produce.
const OLD_SCORES = { solve: 72, spot: 24, explain: 31 };
const BAR_SEQUENCE = ["solve", "explain", "spot"];
const STEP_MS = 900;

export default function DefeatScreen({ session }) {
  const { diagnosis, scores } = session;
  const [revealed, setRevealed] = useState(0); // how many bars have animated
  const [showClose, setShowClose] = useState(false);

  useEffect(() => {
    const timers = BAR_SEQUENCE.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), 400 + i * STEP_MS)
    );
    timers.push(setTimeout(() => setShowClose(true), 400 + BAR_SEQUENCE.length * STEP_MS + 400));
    return () => timers.forEach(clearTimeout);
  }, []);

  const yieldTurn = [...session.turns].reverse().find((t) => t.role === "chintu");

  return (
    <main className="defeat-screen">
      <h1 className="defeat-screen__headline">
        <span className="defeat-screen__id">{diagnosis.misconception_id}</span> DEFEATED
      </h1>

      <div className="defeat-screen__beliefs">
        <p className="defeat-screen__belief defeat-screen__belief--false">
          <span>✗</span> {diagnosis.misconception}
        </p>
        <p className="defeat-screen__belief defeat-screen__belief--true">
          <span>✓</span> {diagnosis.correct_model}
        </p>
      </div>

      <div className="defeat-screen__scores">
        {["solve", "spot", "explain"].map((key) => {
          const done = revealed > BAR_SEQUENCE.indexOf(key);
          const value = done ? scores[key] : OLD_SCORES[key];
          return (
            <div key={key} className="score-row">
              <span className="score-row__label">{copy.defeat.scores[key]}</span>
              <div className="score-row__track">
                <div className="score-row__fill" style={{ width: `${value}%` }} />
              </div>
              <span className="score-row__value">
                {OLD_SCORES[key]} → {done ? scores[key] : "…"}
              </span>
            </div>
          );
        })}
        <p className={`defeat-screen__transfer${showClose ? " is-visible" : ""}`}>
          {copy.defeat.transferVerified} ✓
        </p>
      </div>

      <div className={`defeat-screen__close${showClose ? " is-visible" : ""}`}>
        <Chintu emotion="convinced" beliefStrength={0.1} size={140} />
        <div>
          {yieldTurn && <p className="defeat-screen__yield">“{yieldTurn.text}”</p>}
          <p className="defeat-screen__report">{copy.defeat.beliefReport(diagnosis.misconception)}</p>
        </div>
      </div>

      <TeacherDashboardPreview />

      <button type="button" className="defeat-screen__again" onClick={() => window.location.reload()}>
        {copy.defeat.again}
      </button>
    </main>
  );
}
