import { useEffect, useRef, useState } from "react";

// Nine rendering states from the Agent 2 contract. Values affect expression
// only; the avatar never reasons about the conversation.
const EMOTIONS = {
  idle: { browL: "M56 68 L84 70", browR: "M144 68 L116 70", mouth: "M90 132 Q100 137 110 132", fill: "none", eyeRy: 19, dx: 0, dy: 0, arcEyes: false, blush: 0, tilt: 0 },
  listening: { browL: "M56 64 L84 68", browR: "M144 64 L116 68", mouth: "M92 133 L108 133", fill: "none", eyeRy: 20, dx: -5, dy: 2, arcEyes: false, blush: 0, tilt: -2 },
  thinking: { browL: "M56 72 L84 64", browR: "M144 60 L116 70", mouth: "M90 134 L112 130", fill: "none", eyeRy: 19, dx: -4, dy: -4, arcEyes: false, blush: 0, tilt: -3 },
  confident: { browL: "M56 62 L84 68", browR: "M144 62 L116 68", mouth: "M88 132 Q100 128 112 138", fill: "none", eyeRy: 15, dx: 0, dy: 0, arcEyes: false, blush: 0, tilt: 0 },
  stubborn: { browL: "M56 66 L84 72", browR: "M144 66 L116 72", mouth: "M88 136 Q100 130 112 136", fill: "none", eyeRy: 19, dx: 0, dy: 0, arcEyes: false, blush: 0, tilt: 0 },
  confused: { browL: "M56 62 L84 70", browR: "M144 68 L116 62", mouth: "M94 132 Q100 142 106 132 Q100 138 94 132", fill: "#4A1B0C", eyeRy: 20, dx: 3, dy: 2, arcEyes: false, blush: 0, tilt: 4 },
  surprised: { browL: "M56 56 L84 62", browR: "M144 56 L116 62", mouth: "M100 136 m-9 0 a9 11 0 1 0 18 0 a9 11 0 1 0 -18 0", fill: "#4A1B0C", eyeRy: 23, dx: 0, dy: -2, arcEyes: false, blush: 0, tilt: 0 },
  happy: { browL: "M58 62 Q71 55 84 62", browR: "M142 62 Q129 55 116 62", mouth: "M86 128 Q100 144 114 128", fill: "none", eyeRy: 19, dx: 0, dy: 0, arcEyes: false, blush: 0.35, tilt: 0 },
  convinced: { browL: "M58 60 Q71 52 84 60", browR: "M142 60 Q129 52 116 60", mouth: "M84 126 Q100 146 116 126", fill: "none", eyeRy: 19, dx: 0, dy: 0, arcEyes: true, blush: 0.5, tilt: 0 },
};

export const EMOTION_NAMES = Object.keys(EMOTIONS);
const audioGraphs = new WeakMap();

export function emotionForBelief(beliefStrength) {
  if (beliefStrength > 0.8) return "stubborn";
  if (beliefStrength > 0.5) return "confident";
  if (beliefStrength > 0.2) return "thinking";
  return "convinced";
}

const CSS = `
@keyframes chintu-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes chintu-shadow { 0%,100% { transform: scaleX(1); opacity:.18 } 50% { transform: scaleX(.92); opacity:.12 } }
@keyframes chintu-blink { 0%,94%,100% { transform: scaleY(1) } 96% { transform: scaleY(.05) } }
@keyframes chintu-talk { from { transform: scaleY(.45) } to { transform: scaleY(1.65) } }
@keyframes chintu-nod { 0%,100% { transform: rotate(0) translateY(0) } 45% { transform: rotate(1deg) translateY(5px) } }
@keyframes chintu-point { 0%,100% { transform: rotate(0) } 45% { transform: rotate(-18deg) translate(-3px,-2px) } }
@keyframes chintu-ear { 0%,88%,100% { transform: rotate(0) } 91% { transform: rotate(7deg) } 94% { transform: rotate(-3deg) } }
@keyframes chintu-speak-ring { 0% { opacity:.65; transform:scale(.82) } 100% { opacity:0; transform:scale(1.18) } }
.chintu-avatar { display:inline-grid; place-items:center; isolation:isolate }
.chintu-avatar__svg { overflow:visible }
.chintu-float { transform-box:fill-box; transform-origin:center; animation:chintu-float 3.8s ease-in-out infinite }
.chintu-shadow { transform-box:fill-box; transform-origin:center; animation:chintu-shadow 3.8s ease-in-out infinite }
.chintu-eye { transform-box:fill-box; transform-origin:center; animation:chintu-blink 4.8s infinite }
.chintu-mouth { transform-box:fill-box; transform-origin:center }
.chintu-talking .chintu-mouth { animation:chintu-talk .16s infinite alternate }
.chintu-head--nod { animation:chintu-nod .55s ease-in-out 2 }
.chintu-arm--point { transform-box:fill-box; transform-origin:bottom right; animation:chintu-point .65s ease-in-out 2 }
.chintu-ear--right { transform-box:fill-box; transform-origin:bottom center; animation:chintu-ear 7s ease-in-out infinite }
.chintu-speak-ring { transform-box:fill-box; transform-origin:center; animation:chintu-speak-ring 1.2s ease-out infinite }
@media (prefers-reduced-motion: reduce) {
  .chintu-float,.chintu-shadow,.chintu-eye,.chintu-talking .chintu-mouth,.chintu-head--nod,.chintu-arm--point,.chintu-ear--right,.chintu-speak-ring { animation:none }
}
`;

export default function Chintu({
  emotion,
  beliefStrength = 1,
  gesture = null,
  speaking = false,
  audioRef = null,
  size = 210,
}) {
  const [flash, setFlash] = useState(null);
  const [amp, setAmp] = useState(0);
  const previousBelief = useRef(beliefStrength);

  useEffect(() => {
    const crossed = previousBelief.current >= 0.5 && beliefStrength < 0.5;
    previousBelief.current = beliefStrength;
    if (!crossed) return undefined;
    setFlash("surprised");
    const timer = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(timer);
  }, [beliefStrength]);

  useEffect(() => {
    const element = audioRef?.current;
    if (!element || typeof window === "undefined" || !(window.AudioContext || window.webkitAudioContext)) return undefined;
    let frame;
    let unlock;
    try {
      let graph = audioGraphs.get(element);
      if (!graph) {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        graph = { context, source: context.createMediaElementSource(element) };
        audioGraphs.set(element, graph);
      }
      const { context, source } = graph;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(context.destination);
      unlock = () => context.resume().catch(() => {});
      if (context.state === "suspended") {
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
      }
      const frequencies = new Uint8Array(analyser.frequencyBinCount);
      const sample = () => {
        analyser.getByteFrequencyData(frequencies);
        let sum = 0;
        for (const value of frequencies) sum += value;
        setAmp(sum / frequencies.length / 255);
        frame = requestAnimationFrame(sample);
      };
      sample();
      return () => {
        if (frame) cancelAnimationFrame(frame);
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        try { source.disconnect(analyser); analyser.disconnect(); } catch { /* disconnected */ }
      };
    } catch {
      return () => { if (frame) cancelAnimationFrame(frame); };
    }
  }, [audioRef]);

  const name = flash ?? emotion ?? emotionForBelief(beliefStrength);
  const expression = EMOTIONS[name] ?? EMOTIONS.idle;
  const amplitudeDriven = speaking && amp > 0;
  const mouthStyle = amplitudeDriven ? { transform: `scaleY(${0.45 + amp * 2.1})` } : undefined;
  const headClass = gesture === "nod" ? "chintu-head--nod" : "";
  const armClass = gesture === "point_board" ? "chintu-arm--point" : "";

  return (
    <div className="chintu-avatar">
      <style>{CSS}</style>
      <svg
        className={`chintu-avatar__svg${speaking && !amplitudeDriven ? " chintu-talking" : ""}`}
        viewBox="0 0 260 300"
        width={size}
        height={size * 1.15}
        role="img"
        aria-label={`Chintu is ${name}`}
      >
        <defs>
          <linearGradient id="chintu-fur" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFD7C7" />
            <stop offset=".58" stopColor="#F39B7C" />
            <stop offset="1" stopColor="#D96D4D" />
          </linearGradient>
          <linearGradient id="chintu-hoodie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7569E8" />
            <stop offset="1" stopColor="#4639A8" />
          </linearGradient>
          <radialGradient id="chintu-eye" cx="35%" cy="28%" r="75%">
            <stop offset="0" stopColor="#74503E" />
            <stop offset=".75" stopColor="#3C2018" />
            <stop offset="1" stopColor="#180C09" />
          </radialGradient>
          <filter id="chintu-soft-shadow" x="-35%" y="-35%" width="170%" height="180%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#3A286E" floodOpacity=".18" />
          </filter>
        </defs>

        <ellipse className="chintu-shadow" cx="130" cy="280" rx="66" ry="12" fill="#3D2865" />
        {speaking && <ellipse className="chintu-speak-ring" cx="130" cy="135" rx="91" ry="100" fill="none" stroke="#8C7CFF" strokeWidth="3" />}

        <g className="chintu-float" filter="url(#chintu-soft-shadow)">
          <path d="M203 230 C246 208 244 259 214 263 C235 248 226 232 203 246" fill="none" stroke="#D96D4D" strokeWidth="15" strokeLinecap="round" />

          <path d="M91 251 L89 277 Q87 287 72 286 Q58 284 65 274 L76 249 Z" fill="#3A2E83" />
          <path d="M169 251 L171 277 Q173 287 188 286 Q202 284 195 274 L184 249 Z" fill="#3A2E83" />
          <path d="M67 275 Q78 269 93 276 L92 286 L65 286 Q58 283 67 275" fill="#F8F5FF" />
          <path d="M193 275 Q182 269 167 276 L168 286 L195 286 Q202 283 193 275" fill="#F8F5FF" />

          <path d="M72 184 Q130 155 188 184 L193 251 Q165 269 130 268 Q95 269 67 251 Z" fill="url(#chintu-hoodie)" />
          <path d="M91 177 Q130 208 169 177 Q162 164 130 163 Q98 164 91 177" fill="#392D91" opacity=".9" />
          <path d="M89 206 Q130 224 171 206 L171 249 Q130 261 89 249 Z" fill="#5D50C9" opacity=".46" />
          <path d="M129 189 L126 233" stroke="#E8E4FF" strokeWidth="3" opacity=".8" />
          <circle cx="126" cy="236" r="4" fill="#F7F4FF" />

          <g className={armClass}>
            <path d="M82 196 Q56 208 49 237 Q47 249 60 250 Q70 250 76 230 L92 211" fill="#5D50C9" />
            <ellipse cx="57" cy="246" rx="13" ry="11" fill="#F39B7C" />
          </g>
          <path d="M178 196 Q204 208 211 237 Q213 249 200 250 Q190 250 184 230 L168 211" fill="#5D50C9" />
          <ellipse cx="203" cy="246" rx="13" ry="11" fill="#F39B7C" />
          <path d="M104 228 Q130 237 156 228" stroke="#392D91" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".75" />

          <g className={headClass} style={{ transformBox: "fill-box", transformOrigin: "bottom center" }}>
            <g transform="translate(30 22)" style={{ transform: `rotate(${expression.tilt}deg)`, transformOrigin: "100px 150px", transition: "transform .35s" }}>
              <path d="M46 72 L48 21 Q52 13 60 26 L91 52 Z" fill="url(#chintu-fur)" />
              <path d="M58 59 L60 36 L80 51 Z" fill="#F7B7AD" />
              <g className="chintu-ear--right">
                <path d="M154 72 L152 21 Q148 13 140 26 L109 52 Z" fill="url(#chintu-fur)" />
                <path d="M142 59 L140 36 L120 51 Z" fill="#F7B7AD" />
              </g>

              <ellipse cx="100" cy="101" rx="62" ry="57" fill="url(#chintu-fur)" />
              <ellipse cx="82" cy="82" rx="42" ry="35" fill="#FFE6DB" opacity=".55" />
              <path d="M100 46 Q158 47 160 101 Q159 145 112 157 Q145 130 143 92 Q142 61 100 46" fill="#8A311D" opacity=".18" />
              <path d="M63 60 Q99 39 136 57" fill="none" stroke="#FFF4EE" strokeWidth="8" strokeLinecap="round" opacity=".42" />

              <ellipse cx="57" cy="115" rx="12" ry="7" fill="#E65D68" opacity={expression.blush} />
              <ellipse cx="143" cy="115" rx="12" ry="7" fill="#E65D68" opacity={expression.blush} />
              <ellipse cx="81" cy="127" rx="23" ry="17" fill="#FFF2EA" opacity=".94" />
              <ellipse cx="119" cy="127" rx="23" ry="17" fill="#FFF2EA" opacity=".94" />

              {expression.arcEyes ? (
                <>
                  <path d="M62 97 Q76 83 90 97" stroke="#4A1B0C" strokeWidth="5" fill="none" strokeLinecap="round" />
                  <path d="M110 97 Q124 83 138 97" stroke="#4A1B0C" strokeWidth="5" fill="none" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <ellipse className="chintu-eye" cx="76" cy="93" rx="17" ry={expression.eyeRy} fill="#FFFFFF" />
                  <ellipse className="chintu-eye" cx="124" cy="93" rx="17" ry={expression.eyeRy} fill="#FFFFFF" />
                  <ellipse cx={78 + expression.dx} cy={96 + expression.dy} rx="11" ry="13" fill="url(#chintu-eye)" />
                  <ellipse cx={126 + expression.dx} cy={96 + expression.dy} rx="11" ry="13" fill="url(#chintu-eye)" />
                  <circle cx={74 + expression.dx} cy={90 + expression.dy} r="4.5" fill="#FFFFFF" />
                  <circle cx={122 + expression.dx} cy={90 + expression.dy} r="4.5" fill="#FFFFFF" />
                  <circle cx={82 + expression.dx} cy={101 + expression.dy} r="2" fill="#FFFFFF" opacity=".85" />
                  <circle cx={130 + expression.dx} cy={101 + expression.dy} r="2" fill="#FFFFFF" opacity=".85" />
                </>
              )}

              <path d={expression.browL} stroke="#8E3522" strokeWidth="4.5" fill="none" strokeLinecap="round" />
              <path d={expression.browR} stroke="#8E3522" strokeWidth="4.5" fill="none" strokeLinecap="round" />
              <path d="M94 117 Q100 113 106 117 L100 124 Z" fill="#D94D79" />
              <path className="chintu-mouth" d={expression.mouth} fill={expression.fill} stroke="#4A1B0C" strokeWidth="4.5" strokeLinecap="round" style={mouthStyle} />
              <path d="M20 114 L52 118 M19 129 L52 125 M180 114 L148 118 M181 129 L148 125" stroke="#8E3522" strokeWidth="2.5" strokeLinecap="round" opacity=".46" />

              <path d="M35 92 Q35 43 100 43 Q165 43 165 92" stroke="#302C3C" strokeWidth="8" fill="none" strokeLinecap="round" />
              <rect x="22" y="84" width="27" height="39" rx="12" fill="#302C3C" />
              <rect x="151" y="84" width="27" height="39" rx="12" fill="#302C3C" />
              <rect x="27" y="90" width="7" height="26" rx="3" fill="#6B617A" />
              <rect x="166" y="90" width="7" height="26" rx="3" fill="#6B617A" />
              <path d="M176 111 Q187 119 175 130" stroke="#302C3C" strokeWidth="4" fill="none" strokeLinecap="round" />
              <circle cx="173" cy="132" r="5" fill="#7569E8" stroke="#302C3C" strokeWidth="3" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
