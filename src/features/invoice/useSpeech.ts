import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
interface SpeechRecognitionResultLike { 0: { transcript: string }; isFinal: boolean }
interface SpeechRecognitionEventLike { resultIndex: number; results: { length: number;[i: number]: SpeechRecognitionResultLike } }
interface SpeechRecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// iOS home-screen ("Add to Home Screen") apps run in a standalone WKWebView that has
// never had working microphone access for SpeechRecognition — the API is present and
// feature-detects as supported, but recognition silently fails to produce results. This
// is a longstanding WebKit limitation (not something we can fix), so we detect it up
// front and treat voice as unsupported there rather than offering a mic that can't work.
// `navigator.standalone` is iOS-only and true exactly when launched from the home screen.
function isIOSStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
  return isIOS && nav.standalone === true;
}

/**
 * Voice transcription per VISION §4.1: the mic starts/pauses/resumes transcription
 * while PRESERVING already-transcribed words across pauses. Nothing is submitted here —
 * the caller owns the Send action. `transcript` is editable via setTranscript.
 */
export function useSpeech() {
  const ctorRef = useRef<SpeechRecognitionCtor | null>(getCtor());
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  // Guards against a runaway start/onend restart loop (seen when recognition can start
  // but never actually produce results or errors, e.g. iOS standalone mode) — without
  // this, rapid synchronous restarts can peg the main thread and make the whole page,
  // not just the mic, feel unresponsive.
  const restartTimestampsRef = useRef<number[]>([]);

  const iosStandalone = useRef(isIOSStandalone());
  const [supported] = useState(() => ctorRef.current !== null && !iosStandalone.current);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Ctor = ctorRef.current;
    if (!Ctor || iosStandalone.current) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
      restartTimestampsRef.current = []; // real results prove recognition is working
      let finalChunk = '';
      let interimChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interimChunk += r[0].transcript;
      }
      if (finalChunk) {
        setTranscript((prev) => (prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim()));
      }
      setInterim(interimChunk);
    };
    rec.onend = () => {
      // Browsers end the session on silence; if the user hasn't paused, keep going —
      // but if it's ending faster than real speech-silence timeouts ever would, stop
      // instead of spinning forever.
      if (!listeningRef.current) {
        setInterim('');
        return;
      }
      const now = Date.now();
      restartTimestampsRef.current = [...restartTimestampsRef.current, now].filter((t) => now - t < 5000);
      if (restartTimestampsRef.current.length > 6) {
        listeningRef.current = false;
        setListening(false);
        setInterim('');
        setError("Voice dictation isn't working here — try typing, or open this app in Safari instead of the installed icon.");
        return;
      }
      try { rec.start(); } catch { /* already starting */ }
    };
    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      setError(ev.error);
    };

    recRef.current = rec;
    return () => {
      listeningRef.current = false;
      try { rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current || listeningRef.current) return;
    setError(null);
    restartTimestampsRef.current = [];
    listeningRef.current = true;
    setListening(true);
    try { recRef.current.start(); } catch { /* already started */ }
  }, []);

  const pause = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    try { recRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const toggle = useCallback(() => {
    if (listeningRef.current) pause(); else start();
  }, [start, pause]);

  const clear = useCallback(() => {
    setTranscript('');
    setInterim('');
  }, []);

  return { supported, listening, transcript, interim, error, setTranscript, start, pause, toggle, clear };
}
