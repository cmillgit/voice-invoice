import { useState } from 'react';
import { useSpeech } from './useSpeech';
import { MicButton } from './MicButton';
import { SendIcon } from '../../components/icons';

interface Turn { role: 'user' | 'agent'; text: string }

/**
 * Voice compose surface (VISION §4.1). Mic captures speech; the transcript is editable
 * and nothing submits until Send. The Send handler will (step 5) call the Supabase Edge
 * Function → Claude to extract structured invoice inputs and apply them to the draft.
 * Until then, Send records the turn so the interaction model is in place.
 */
export function ComposePanel({
  disabled,
  onApplyParsed,
}: {
  disabled?: boolean;
  onApplyParsed: (utterance: string) => void;
}) {
  const { supported, listening, transcript, interim, error, setTranscript, toggle, clear } = useSpeech();
  const [turns, setTurns] = useState<Turn[]>([]);

  const pending = (transcript + (interim ? ` ${interim}` : '')).trim();

  function send() {
    const text = transcript.trim();
    if (!text) return;
    setTurns((t) => [
      ...t,
      { role: 'user', text },
      { role: 'agent', text: 'Voice understanding is wired up next — for now, add line items below. Your words were captured.' },
    ]);
    onApplyParsed(text);
    clear();
  }

  return (
    <div className="card" style={{ padding: 'var(--s-4)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
      <div className="label">Dictate</div>

      {turns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', maxHeight: 180, overflow: 'auto' }}>
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
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'stretch' }}>
        <MicButton listening={listening} disabled={disabled || !supported} onToggle={toggle} />
        <textarea
          className="textarea"
          style={{ flex: 1, minHeight: 56 }}
          placeholder={supported ? 'Tap the mic and speak, or type here…' : 'Voice not supported in this browser — type here…'}
          value={pending}
          disabled={disabled}
          onChange={(e) => setTranscript(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          {listening ? 'Listening… tap the mic to pause.' : error ? `Mic error: ${error}` : 'Nothing is sent until you press Send.'}
        </span>
        <button className="btn btn-primary btn-sm" onClick={send} disabled={disabled || !transcript.trim()}>
          <SendIcon size={14} /> Send
        </button>
      </div>
    </div>
  );
}
