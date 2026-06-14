// Agent voice output (VISION §4.1: agent has spoken output). Uses the browser's
// SpeechSynthesis. Speaking is cancelled when the user starts dictating so the
// agent never talks over him.

export const speechOut = {
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window,

  speak(text: string) {
    if (!this.supported || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  },

  cancel() {
    if (this.supported) window.speechSynthesis.cancel();
  },
};
