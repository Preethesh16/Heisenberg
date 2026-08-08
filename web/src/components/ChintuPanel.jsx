import Chintu from "./Chintu";
import BeliefMeter from "./BeliefMeter";

// Deliberately narrow props. This panel never sees correct_model,
// repair_criteria, or Judge output — the same isolation the server enforces
// on Agent 2, kept in the UI layer.
export default function ChintuPanel({ emotion, gesture, beliefStrength, speaking, audioRef }) {
  return (
    <aside className="chintu-panel">
      <div className="chintu-panel__identity">
        <span className="chintu-panel__online" aria-hidden="true" />
        <span>Chintu</span>
        <small>AI classmate</small>
      </div>
      <Chintu
        emotion={emotion}
        beliefStrength={beliefStrength}
        gesture={gesture}
        speaking={speaking}
        audioRef={audioRef}
        size={220}
      />
      <div className="chintu-panel__emotion"><span aria-hidden="true">✦</span> {emotion}</div>
      <BeliefMeter value={beliefStrength} />
    </aside>
  );
}
