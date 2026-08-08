// VoiceInvoice wordmark — the RAM Painting & Construction ram-head mark, stacked above
// the app's own name. The ram head is the real business's mark (see VISION §5); the app
// keeps its own name/color treatment beneath it, since VoiceInvoice is the tool, not the
// business's brand.

import ramMark from '../assets/ram-mark.png';

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 0 : 'var(--s-2)' }}>
      <img
        src={ramMark}
        alt="RAM Painting & Construction"
        style={{ width: compact ? 32 : 52, height: 'auto', display: 'block' }}
      />
      {!compact && (
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-md)', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Voice<span style={{ color: 'var(--accent)' }}>Invoice</span>
        </span>
      )}
    </div>
  );
}
