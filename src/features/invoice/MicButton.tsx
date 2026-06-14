import { MicIcon, PauseIcon } from '../../components/icons';

/**
 * The mic button (VISION §8 signature surface). Tap to start, tap to pause/resume.
 * Listening state is unmistakable. Pausing preserves the transcript (handled by useSpeech).
 */
export function MicButton({
  listening,
  disabled,
  onToggle,
}: {
  listening: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? 'Pause dictation' : 'Start dictation'}
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: 'var(--radius)',
        border: `1px solid ${listening ? 'var(--accent)' : 'var(--line-strong)'}`,
        background: listening ? 'var(--accent)' : 'var(--surface)',
        color: listening ? '#fff' : 'var(--ink)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        transition: 'background var(--dur) var(--ease), border-color var(--dur) var(--ease)',
      }}
    >
      {listening ? <PauseIcon size={22} /> : <MicIcon size={22} />}
      {listening && (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: -1, borderRadius: 'var(--radius)',
            border: '2px solid var(--accent)', animation: 'mic-pulse 1.4s var(--ease) infinite',
          }}
        />
      )}
      <style>{`@keyframes mic-pulse {
        0% { opacity: 0.7; transform: scale(1); }
        70% { opacity: 0; transform: scale(1.18); }
        100% { opacity: 0; transform: scale(1.18); }
      }`}</style>
    </button>
  );
}
