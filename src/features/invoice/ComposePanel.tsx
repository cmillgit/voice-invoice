import { useState } from 'react';
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

  const pending = (transcript + (interim ? ` ${interim}` : '')).trim();

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
    <div className="card" style={{ padding: 'var(--s-4)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', maxHeight: 200, overflow: 'auto' }}>
          {turns.map((t, i) => (
            <div key={i} style={{
              alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              background: t.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: t.role === 'user' ? 'var(--accent-ink)' : 'var(--ink-2)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius)',
              padding: '8px 10px', fontSize: 'var(--text-sm)',
            }}>{t.text}</div>
          ))}
          {busy && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--muted)', fontSize: 'var(--text-sm)', padding: '4px 10px' }}>
              Thinking…
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'stretch' }}>
        <MicButton listening={listening} disabled={disabled || !supported || busy} onToggle={handleMic} />
        <textarea
          className="textarea"
          style={{ flex: 1, minHeight: 56 }}
          placeholder={supported ? 'Tap the mic and speak, or type here…' : 'Voice not supported in this browser — type here…'}
          value={pending}
          disabled={disabled || busy}
          onChange={(e) => setTranscript(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--s-2)' }}>
        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          {listening ? 'Listening… tap to pause.'
            : sendError ? `Error: ${sendError}`
            : error ? `Mic: ${error}`
            : 'Nothing is sent until you press Send.'}
        </span>
        <button className="btn btn-primary btn-sm" onClick={send} disabled={disabled || busy || !transcript.trim()}>
          <SendIcon size={14} /> Send
        </button>
      </div>
    </div>
  );
}
