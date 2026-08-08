import { useEffect, useRef, useState } from "react";

/**
 * ULTA — Chintu avatar
 *
 * The body layer. Claude is the mind, Maya is the voice, this is the body.
 * It renders whatever the Mirror agent (Agent 2) reports and never decides
 * anything about the conversation itself.
 *
 * Wire it straight to Agent 2's structured output:
 *
 *   const { reply, emotion, gesture, belief_strength, should_yield } = chintuResponse;
 *   <Chintu
 *     emotion={emotion}
 *     beliefStrength={belief_strength}
 *     gesture={gesture}
 *     speaking={isMayaPlaying}
 *     audioRef={mayaAudioRef}
 *   />
 */

// The nine states from the ULTA spec, section 12.
const EMOTIONS = {
  idle: {
    browL: "M56 68 L84 70", browR: "M144 68 L116 70",
    mouth: "M90 132 Q100 137 110 132", fill: "none",
    eyeRy: 19, dx: 0, dy: 0, arcEyes: false, blush: 0, tilt: 0,
  },
  listening: {
    browL: "M56 64 L84 68", browR: "M144 64 L116 68",
    mouth: "M92 133 L108 133", fill: "none",
    eyeRy: 20, dx: -5, dy: 2, arcEyes: false, blush: 0, tilt: -2,
  },
  thinking: {
    browL: "M56 72 L84 64", browR: "M144 60 L116 70",
    mouth: "M90 134 L112 130", fill: "none",
    eyeRy: 19, dx: -4, dy: -4, arcEyes: false, blush: 0, tilt: -3,
  },
  confident: {
    browL: "M56 62 L84 68", browR: "M144 62 L116 68",
    mouth: "M88 132 Q100 128 112 138", fill: "none",
    eyeRy: 15, dx: 0, dy: 0, arcEyes: false, blush: 0, tilt: 0,
  },
  stubborn: {
    browL: "M56 66 L84 72", browR: "M144 66 L116 72",
    mouth: "M88 136 Q100 130 112 136", fill: "none",
    eyeRy: 19, dx: 0, dy: 0, arcEyes: false, blush: 0, tilt: 0,
  },
  confused: {
    browL: "M56 62 L84 70", browR: "M144 68 L116 62",
    mouth: "M94 132 Q100 142 106 132 Q100 138 94 132", fill: "#4A1B0C",
    eyeRy: 20, dx: 3, dy: 2, arcEyes: false, blush: 0, tilt: 4,
  },
  surprised: {
    browL: "M56 56 L84 62", browR: "M144 56 L116 62",
    mouth: "M100 136 m-9 0 a9 11 0 1 0 18 0 a9 11 0 1 0 -18 0", fill: "#4A1B0C",
    eyeRy: 23, dx: 0, dy: -2, arcEyes: false, blush: 0, tilt: 0,
  },
  happy: {
    browL: "M58 62 Q71 55 84 62", browR: "M142 62 Q129 55 116 62",
    mouth: "M86 128 Q100 144 114 128", fill: "none",
    eyeRy: 19, dx: 0, dy: 0, arcEyes: false, blush: 0.35, tilt: 0,
  },
  convinced: {
    browL: "M58 60 Q71 52 84 60", browR: "M142 60 Q129 52 116 60",
    mouth: "M84 126 Q100 146 116 126", fill: "none",
    eyeRy: 19, dx: 0, dy: 0, arcEyes: true, blush: 0.5, tilt: 0,
  },
};

export const EMOTION_NAMES = Object.keys(EMOTIONS);

// One Web Audio graph per <audio> element, for the element's whole lifetime.
const audioGraphs = new WeakMap();

/**
 * Fallback only. Agent 2 should report `emotion` directly; use this when it
 * doesn't, or when you're driving the avatar from the Judge's score alone.
 * belief_strength is 0–1, matching the ULTA agent contract.
 */
export function emotionForBelief(beliefStrength) {
  if (beliefStrength > 0.8) return "stubborn";
  if (beliefStrength > 0.5) return "confident";
  if (beliefStrength > 0.2) return "thinking";
  return "convinced";
}

const CSS = `
@keyframes ulta-blink { 0%,95%,100% { transform: scaleY(1) } 97% { transform: scaleY(.06) } }
@keyframes ulta-talk  { from { transform: scaleY(.35) } to { transform: scaleY(1.7) } }
@keyframes ulta-nod   { 0%,100% { transform: translateY(0) } 50% { transform: translateY(5px) } }
@keyframes ulta-point { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-7deg) } }
.ulta-eye { transform-box: fill-box; transform-origin: center; animation: ulta-blink 4.6s infinite }
.ulta-mouth { transform-box: fill-box; transform-origin: center }
.ulta-talking .ulta-mouth { animation: ulta-talk .17s infinite alternate }
.ulta-nod { animation: ulta-nod .5s ease-in-out 2 }
.ulta-point { animation: ulta-point .6s ease-in-out 2 }
@media (prefers-reduced-motion: reduce) {
  .ulta-eye, .ulta-talking .ulta-mouth, .ulta-nod, .ulta-point { animation: none }
}`;

export default function Chintu({
  emotion,                 // from Agent 2. Falls back to beliefStrength.
  beliefStrength = 1,      // 0–1, Agent 2's belief_strength
  gesture = null,          // "nod" | "point_board" | null
  speaking = false,        // true while Maya audio is playing
  audioRef = null,         // optional <audio> ref for amplitude lip sync
  size = 190,
}) {
  const [flash, setFlash] = useState(null);
  const [amp, setAmp] = useState(0);
  const prev = useRef(beliefStrength);

  // The aha moment: fire "surprised" once, the turn belief crosses below 0.5.
  useEffect(() => {
    const crossed = prev.current >= 0.5 && beliefStrength < 0.5;
    prev.current = beliefStrength; // track every change, or the flash re-fires
    if (crossed) {
      setFlash("surprised");
      const t = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(t);
    }
  }, [beliefStrength]);

  // Amplitude-driven lip sync from Maya's audio.
  // createMediaElementSource runs once per <audio> element, ever — the graph
  // is cached per element so remounts reuse it instead of throwing. The
  // context unlocks on the first genuine user gesture (browsers create
  // gesture-less contexts suspended, which reads as an all-zero analyser).
  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;
    let raf;
    let unlock;
    try {
      let graph = audioGraphs.get(el);
      if (!graph) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        graph = { ctx, source: ctx.createMediaElementSource(el) };
        audioGraphs.set(el, graph);
      }
      const { ctx, source } = graph;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      unlock = () => { ctx.resume().catch(() => {}); };
      if (ctx.state === "suspended") {
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
      }
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        setAmp(sum / buf.length / 255);
        raf = requestAnimationFrame(loop);
      };
      loop();
      return () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        // keep ctx and source alive — they belong to the element for its lifetime
        try { source.disconnect(analyser); analyser.disconnect(); } catch { /* already gone */ }
      };
    } catch (err) {
      // Already-connected element or blocked context: fall back to the CSS flap.
      console.warn("ULTA lip sync unavailable, using fallback", err);
      return () => { if (raf) cancelAnimationFrame(raf); };
    }
  }, [audioRef]);

  const name = flash ?? emotion ?? emotionForBelief(beliefStrength);
  const e = EMOTIONS[name] ?? EMOTIONS.idle;

  const useAmp = speaking && amp > 0;
  const mouthStyle = useAmp ? { transform: `scaleY(${0.4 + amp * 2.2})` } : undefined;
  const gestureClass =
    gesture === "nod" ? "ulta-nod" : gesture === "point_board" ? "ulta-point" : "";

  return (
    <div style={{ display: "inline-block" }}>
      <style>{CSS}</style>
      <svg
        viewBox="0 0 200 205"
        width={size}
        height={(size * 205) / 200}
        role="img"
        aria-label={`Chintu is ${name}`}
        className={speaking && !useAmp ? "ulta-talking" : undefined}
      >
        <rect x="44" y="152" width="112" height="52" rx="26" fill="#534AB7" />
        <path d="M62 154 Q100 178 138 154 L138 166 Q100 188 62 166 Z" fill="#3C3489" />

        <g
          className={gestureClass}
          style={{
            transformBox: "fill-box",
            transformOrigin: "bottom center",
            transform: `rotate(${e.tilt}deg)`,
            transition: "transform .35s",
          }}
        >
          <path d="M46 72 L50 26 L88 50 Z" fill="#F0997B" />
          <path d="M58 60 L61 40 L79 50 Z" fill="#F5C4B3" />
          <path d="M154 72 L150 26 L112 50 Z" fill="#F0997B" />
          <path d="M142 60 L139 40 L121 50 Z" fill="#F5C4B3" />

          <ellipse cx="100" cy="98" rx="60" ry="54" fill="#F0997B" />
          <ellipse cx="86" cy="86" rx="49" ry="43" fill="#F5C4B3" opacity=".85" />
          <ellipse cx="78" cy="74" rx="31" ry="25" fill="#FAECE7" opacity=".55" />
          <path
            d="M100 44 Q160 44 160 98 Q160 152 100 152 Q142 136 142 98 Q142 60 100 44 Z"
            fill="#993C1D"
            opacity=".28"
          />

          <ellipse cx="56" cy="112" rx="11" ry="6" fill="#D85A30" opacity={e.blush} />
          <ellipse cx="144" cy="112" rx="11" ry="6" fill="#D85A30" opacity={e.blush} />
          <ellipse cx="82" cy="124" rx="22" ry="15" fill="#FAECE7" opacity=".9" />
          <ellipse cx="118" cy="124" rx="22" ry="15" fill="#FAECE7" opacity=".9" />

          {e.arcEyes ? (
            <>
              <path d="M62 96 Q76 82 90 96" stroke="#4A1B0C" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M110 96 Q124 82 138 96" stroke="#4A1B0C" strokeWidth="5" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse className="ulta-eye" cx="76" cy="92" rx="16" ry={e.eyeRy} fill="#FFFFFF" />
              <ellipse className="ulta-eye" cx="124" cy="92" rx="16" ry={e.eyeRy} fill="#FFFFFF" />
              <ellipse cx={78 + e.dx} cy={95 + e.dy} rx="10" ry="12" fill="#4A1B0C" />
              <ellipse cx={126 + e.dx} cy={95 + e.dy} rx="10" ry="12" fill="#4A1B0C" />
              <circle cx={74 + e.dx} cy={89 + e.dy} r="4" fill="#FFFFFF" />
              <circle cx={122 + e.dx} cy={89 + e.dy} r="4" fill="#FFFFFF" />
            </>
          )}

          <path d={e.browL} stroke="#993C1D" strokeWidth="4.5" fill="none" strokeLinecap="round" style={{ transition: "d .25s" }} />
          <path d={e.browR} stroke="#993C1D" strokeWidth="4.5" fill="none" strokeLinecap="round" style={{ transition: "d .25s" }} />

          <path d="M94 116 L106 116 L100 123 Z" fill="#D4537E" />
          <path
            className="ulta-mouth"
            d={e.mouth}
            fill={e.fill}
            stroke="#4A1B0C"
            strokeWidth="4.5"
            strokeLinecap="round"
            style={mouthStyle}
          />

          <path
            d="M22 112 L52 116 M22 126 L52 123 M178 112 L148 116 M178 126 L148 123"
            stroke="#993C1D"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity=".6"
          />
        </g>

        <path d="M36 92 Q36 46 100 46 Q164 46 164 92" stroke="#2C2C2A" strokeWidth="7" fill="none" strokeLinecap="round" />
        <rect x="24" y="86" width="24" height="34" rx="10" fill="#2C2C2A" />
        <rect x="152" y="86" width="24" height="34" rx="10" fill="#2C2C2A" />
      </svg>
    </div>
  );
}
