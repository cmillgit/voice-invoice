import { useEffect, useState } from 'react';
import { getBusinessProfile, saveBusinessProfile } from './api';
import { CheckIcon } from '../../components/icons';

/**
 * The business "bill from" identity — name, address, phone shown on every invoice
 * document and PDF. Flagged as missing in VISION §5/§10 after reviewing real invoices;
 * this is where it's set. One row per user (single-business app).
 */
export function BusinessSettingsPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBusinessProfile()
      .then((profile) => {
        if (profile) {
          setName(profile.name);
          setAddress(profile.address ?? '');
          setPhone(profile.phone ?? '');
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load business profile.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!name.trim()) { setError('Business name is required.'); return; }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveBusinessProfile({
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save business profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="muted" style={{ padding: 'var(--s-6)' }}>Loading…</div>;
  }

  return (
    <div style={{ padding: 'var(--s-6)', maxWidth: 640, margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--s-5)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)' }}>Business</h1>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--s-1)' }}>
          Your business identity — shown as the "bill from" on every invoice and PDF.
        </p>
      </header>

      <div className="card" style={{ padding: 'var(--s-5)', display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
        <div className="field">
          <label className="label">Business name</label>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </div>
        <div className="field">
          <label className="label">Address</label>
          <textarea className="textarea" value={address} onChange={(e) => { setAddress(e.target.value); setSaved(false); }} />
        </div>
        <div className="field">
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} />
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ok)', fontSize: 'var(--text-sm)' }}>
              <CheckIcon size={14} /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
