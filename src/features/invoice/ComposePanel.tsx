import { useEffect, useRef, useState } from 'react';
import { useSpeech } from './useSpeech';
import { speechOut } from './speech-out';
import { MicButton } from './MicButton';
import { SendIcon } from '../../components/icons';
import type { Turn } from './agent';

/**
 * Voice compose surface (VISION §4.1). Mic captures speech; the transcript is editable
 * and nothing submits until Send. On Send we call the agent (via onUtterance), which
 * resolves the dictation into the draft and returns a short reply that is shown and
 * spoken aloud. The agent never speaks while the mic is listening.
 */
export function ComposePanel({
  disabled,
  onUtterance,
}: {
  disabled?: boolean;
  onUtterance: (utterance: string, conversation: Turn[]) => Promise<string>;
}) {
  const { supported, listening, transcript, interim, error, setTranscript, start, pause, clear } = useSpeech();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(speechOut.supported);
  const [sendError, setSendError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  function handleMic() {
    if (listening) { pause(); return; }
    speechOut.cancel(); // never let the agent talk over him
    start();
  }

  async function send() {
    const text = transcript.trim();
    if (!text || busy) return;
    if (listening) pause();
    speechOut.cancel();

    const prior = turns;
    setTurns((t) => [...t, { role: 'user', text }]);
    clear();
    setBusy(true);
    setSendError(null);
    try {
      const reply = await onUtterance(text, prior);
      setTurns((t) => [...t, { role: 'agent', text: reply }]);
      if (voiceOn) speechOut.speak(reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      setSendError(msg);
      setTurns((t) => [...t, { role: 'agent', text: `Sorry — ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card compose-panel" style={{ padding: 'var(--s-4)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="label">Dictate</div>
        {speechOut.supported && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            <input type="checkbox" checked={voiceOn} onChange={(e) => { setVoiceOn(e.target.checked); if (!e.target.checked) speechOut.cancel(); }} />
            Voice replies
          </label>
        )}
      </div>

      {turns.length > 0 && (
        <div ref={threadRef} className="compose-thread">
          {turns.map((t, i) => (
            <div key={i} className={`compose-bubble ${t.role === 'user' ? 'compose-bubble-user' : 'compose-bubble-agent'}`}>
              {t.text}
            </div>
          ))}
          {busy && (
            <div className="compose-thinking" aria-label="Thinking">
              <span /><span /><span />
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-end' }}>
        <MicButton listening={listening} disabled={disabled || !supported || busy} onToggle={handleMic} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="compose-input-bar">
            <textarea
              className="textarea"
              style={{ flex: 1, resize: 'none' }}
              rows={1}
              placeholder={supported ? 'Tap the mic and speak, or type here…' : 'Voice dictation isn\'t available here — type here, or open this app in Safari (not the installed icon) to dictate…'}
              value={transcript}
              disabled={disabled || busy}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <button className="btn btn-primary compose-send-btn" onClick={send} disabled={disabled || busy || !transcript.trim()} aria-label="Send">
              <SendIcon size={16} />
            </button>
          </div>
          {listening && interim && (
            <div className="muted" style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic', paddingLeft: 4 }}>{interim}</div>
          )}
        </div>
      </div>

      <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
        {listening ? 'Listening… tap to pause.'
          : sendError ? `Error: ${sendError}`
          : error ? `Mic: ${error}`
          : 'Nothing is sent until you press Send.'}
      </div>
    </div>
  );
}
