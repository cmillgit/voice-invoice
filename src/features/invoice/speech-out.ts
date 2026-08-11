// Agent voice output (VISION §4.1: agent has spoken output). Calls the `speak` Supabase
// Edge Function (ElevenLabs) for natural speech instead of the browser's robotic
// SpeechSynthesis. Speaking is cancelled when the user starts dictating so the agent
// never talks over him. Voice output is a nicety, not core functionality — any failure
// (network, quota, missing key) is swallowed silently rather than surfaced as an error.

import { supabase } from '../../lib/supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speak`;

let currentAudio: HTMLAudioElement | null = null;
let currentAbort: AbortController | null = null;

function stopPlayback() {
  currentAbort?.abort();
  currentAbort = null;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

export const speechOut = {
  supported: typeof Audio !== 'undefined',

  async speak(text: string) {
    if (!this.supported || !text) return;
    stopPlayback();

    const controller = new AbortController();
    currentAbort = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok || controller.signal.aborted) return;

      const blob = await res.blob();
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
      audio.addEventListener('error', () => URL.revokeObjectURL(url));
      await audio.play().catch(() => {});
    } catch {
      // Aborted or network failure — voice output failing shouldn't break the app.
    }
  },

  cancel() {
    stopPlayback();
  },
};
