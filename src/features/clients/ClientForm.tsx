import { useState } from 'react';
import type { Client, RateType } from '../../lib/types';
import { RATE_TYPES, rateTypeUnit } from '../../lib/types';
import type { ClientInput, RateInput } from './api';
import { PlusIcon, TrashIcon } from '../../components/icons';

interface Props {
  initial?: Client | null;
  onCancel: () => void;
  onSave: (input: ClientInput) => Promise<void>;
}

export function ClientForm({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [accountId, setAccountId] = useState(initial?.account_id ?? '');
  const [synonyms, setSynonyms] = useState((initial?.synonyms ?? []).join(', '));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [rates, setRates] = useState<RateInput[]>(
    (initial?.client_rates ?? []).map((r) => ({
      rate_type: r.rate_type,
      rate_amount: r.rate_amount,
      is_default: r.is_default,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRate() {
    const used = new Set(rates.map((r) => r.rate_type));
    const next = RATE_TYPES.find((t) => !used.has(t.value))?.value ?? 'hourly';
    setRates([...rates, { rate_type: next, rate_amount: 0, is_default: rates.length === 0 }]);
  }
  function updateRate(i: number, patch: Partial<RateInput>) {
    setRates((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function setDefault(i: number) {
    setRates((rs) => rs.map((r, idx) => ({ ...r, is_default: idx === i })));
  }
  function removeRate(i: number) {
    setRates((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!name.trim()) { setError('Client name is required.'); return; }
    if (rates.some((r) => r.rate_amount <= 0)) { setError('Every rate needs an amount greater than 0.'); return; }
    if (rates.length > 0 && !rates.some((r) => r.is_default)) { setError('Mark one rate as the default.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        address: address.trim() || null,
        account_id: accountId.trim() || null,
        synonyms: synonyms.split(',').map((s) => s.trim()).filter(Boolean),
        notes: notes.trim() || null,
        rates,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,0.35)', display: 'grid',
        placeItems: 'center', padding: 'var(--s-4)', zIndex: 50 }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxHeight: '88vh', overflow: 'auto', padding: 'var(--s-6)' }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--s-5)' }}>
          {initial ? 'Edit client' : 'New client'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          <div className="field">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
            <div className="field">
              <label className="label">Account ID</label>
              <input className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Synonyms (comma-separated)</label>
              <input className="input" value={synonyms} onChange={(e) => setSynonyms(e.target.value)}
                placeholder="e.g. Johnson account, the warehouse" />
            </div>
          </div>
          <div className="field">
            <label className="label">Address</label>
            <textarea className="textarea" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          {/* Rates */}
          <div className="field">
            <label className="label">Rate structures</label>
            <div className="card" style={{ padding: 'var(--s-3)' }}>
              {rates.length === 0 && (
                <div className="muted" style={{ fontSize: 'var(--text-sm)', padding: 'var(--s-2)' }}>
                  No rates yet. Add the client's default rate.
                </div>
              )}
              {rates.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-2)' }}>
                  <select className="select" value={r.rate_type} style={{ width: 140 }}
                    onChange={(e) => updateRate(i, { rate_type: e.target.value as RateType })}>
                    {RATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <span className="muted">$</span>
                    <input className="input tnum" type="number" min="0" step="0.01" value={r.rate_amount || ''}
                      onChange={(e) => updateRate(i, { rate_amount: parseFloat(e.target.value) || 0 })} />
                    <span className="muted" style={{ whiteSpace: 'nowrap' }}>/ {rateTypeUnit(r.rate_type)}</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                    <input type="radio" name="default-rate" checked={r.is_default} onChange={() => setDefault(i)} />
                    Default
                  </label>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeRate(i)} aria-label="Remove rate">
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              {rates.length < RATE_TYPES.length && (
                <button className="btn btn-ghost btn-sm" onClick={addRate} style={{ marginTop: 'var(--s-1)' }}>
                  <PlusIcon size={14} /> Add rate
                </button>
              )}
            </div>
          </div>

          <div className="field">
            <label className="label">Notes</label>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)', marginTop: 'var(--s-6)' }}>
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save client'}
          </button>
        </div>
      </div>
    </div>
  );
}
