// VoiceInvoice wordmark — angular mark + restrained type, per the design language.

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="25" height="25" rx="3.5" stroke="var(--accent)" />
        {/* angular "soundwave" bars */}
        <rect x="6" y="11" width="2.5" height="4" fill="var(--accent)" />
        <rect x="10" y="8" width="2.5" height="10" fill="var(--accent)" />
        <rect x="14" y="6" width="2.5" height="14" fill="var(--accent)" />
        <rect x="18" y="10" width="2.5" height="6" fill="var(--accent)" />
      </svg>
      {!compact && (
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Voice<span style={{ color: 'var(--accent)' }}>Invoice</span>
        </span>
      )}
    </div>
  );
}
