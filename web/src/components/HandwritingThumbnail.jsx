// The learner's own page stays pinned on screen — the cheapest proof that the
// diagnosis came from their work and wasn't hardcoded.
export default function HandwritingThumbnail({ src }) {
  if (!src) return null;
  return (
    <figure className="handwriting-thumb">
      <img src={src} alt="Your uploaded solution" />
    </figure>
  );
}
