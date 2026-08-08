// Every user-facing string lives here. One file to audit before the demo:
// no praise copy, sentence case, report what happened to the belief.

export const copy = {
  appName: "ULTA",
  tagline: "Don't ask AI. Teach it.",

  upload: {
    heading: "Show us where it went wrong",
    sub: "Upload a photo of your handwritten solution. Chintu will pick up the same idea and run with it.",
    questionLabel: "Question text (optional)",
    questionPlaceholder: "Type the question you were solving",
    cta: "Start the session",
    diagnosing: "Reading your work…",
  },

  roleBanner: {
    debate: "You are the teacher",
    judging: "You are the teacher",
    transfer: "Same idea, new disguise",
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
    hold: "Hold to teach",
    release: "Listening… release to send",
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
