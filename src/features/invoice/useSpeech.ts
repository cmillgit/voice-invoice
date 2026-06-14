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

/**
 * Voice transcription per VISION §4.1: the mic starts/pauses/resumes transcription
 * while PRESERVING already-transcribed words across pauses. Nothing is submitted here —
 * the caller owns the Send action. `transcript` is editable via setTranscript.
 */
export function useSpeech() {
  const ctorRef = useRef<SpeechRecognitionCtor | null>(getCtor());
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);

  const [supported] = useState(() => ctorRef.current !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Ctor = ctorRef.current;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
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
      // Browsers end the session on silence; if the user hasn't paused, keep going.
      if (listeningRef.current) {
        try { rec.start(); } catch { /* already starting */ }
      } else {
        setInterim('');
      }
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
