// Every user-facing string lives here. One file to audit before the demo:
// no praise copy, sentence case, report what happened to the belief.

export const copy = {
  appName: "ULTA",
  tagline: "Don't ask AI. Teach it.",

  upload: {
    heading: "What were you working on?",
    sub: "Upload a clear page from maths, science, or another academic subject. Include the question for the sharpest diagnosis.",
    questionLabel: "Question text (optional)",
    questionPlaceholder: "Type the question you were solving",
    voiceHeading: "Start by talking",
    voiceSub: "Ask Chintu what you are stuck on. Add your working below so Vision can find the idea behind it.",
    cta: "Let Chintu inspect it",
    diagnosing: "Reading every step…",
  },

  // "You are the teacher" stays up for the entire session (ULTA-DESIGN §36);
  // the transfer card carries the "same idea, new disguise" framing.
  roleBanner: {
    debate: "You are the teacher",
    judging: "You are the teacher",
    transfer: "You are the teacher",
    done: "Session over",
  },

  misconceptionCard: {
    label: "Chintu believes",
  },

  chintuPanel: {
    beliefLabel: "Belief",
  },

  transcript: {
    empty: "Chintu is looking at the problem…",
  },

  mic: {
    idle: "Talk to Chintu",
    requesting: "Opening microphone…",
    recording: "Listening — tap to send",
    transcribing: "Turning speech into text…",
    idleHint: "Tap once to speak. Tap again when your explanation is complete.",
    recordingHint: "Chintu is listening. Your turn sends when you tap again.",
    processingHint: "Keeping your place while the transcript arrives.",
    textPlaceholder: "Type your argument instead",
    textSend: "Send",
  },

  languages: [
    { value: "en", label: "English" },
    { value: "hi", label: "Hinglish" },
    { value: "kn", label: "ಕನ್ನಡ + English" },
  ],

  stageRail: ["Diagnosed", "Teaching", "Judge", "Transfer"],

  transferIntro: "Chintu wants to try one more. Different setup, same idea underneath.",

  defeat: {
    headline: (id) => `${id} defeated`,
    transferVerified: "Transfer verified",
    beliefReport: (falseBelief) => `Chintu no longer believes ${falseBelief.replace(/\.$/, "").toLowerCase()}.`,
    scores: { solve: "Solve", spot: "Spot", explain: "Explain" },
    dashboardNote: "What a teacher would see",
    again: "Bring another belief",
  },
};
