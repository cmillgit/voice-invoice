import { useEffect, useState } from 'react';
import type { Client } from '../../lib/types';
import { rateTypeLabel, rateTypeUnit } from '../../lib/types';
import { money } from '../../lib/format';
import { listClients, createClient, updateClient, deleteClient, type ClientInput } from './api';
import { ClientForm } from './ClientForm';
import { PlusIcon } from '../../components/icons';

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setClients(await listClients());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clients.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleSave(input: ClientInput) {
    if (editing) await updateClient(editing.id, input);
    else await createClient(input);
    setEditing(null);
    setCreating(false);
    await refresh();
  }

  async function handleDelete(c: Client) {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    await deleteClient(c.id);
    await refresh();
  }

  return (
    <div style={{ padding: 'var(--s-6)', maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-5)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)' }}>Clients</h1>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--s-1)' }}>
            Contact details, rate structures, and voice synonyms.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> New client
        </button>
      </header>

      {error && (
        <div className="card" style={{ padding: 'var(--s-4)', color: 'var(--danger)', marginBottom: 'var(--s-4)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="muted" style={{ padding: 'var(--s-6)' }}>Loading…</div>
      ) : clients.length === 0 ? (
        <div className="card" style={{ padding: 'var(--s-7)', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: 'var(--s-2)' }}>No clients yet</p>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--s-4)' }}>
            Add a client so you can invoice them by voice.
          </p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon size={16} /> New client
          </button>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Account</th>
                <th>Rates</th>
                <th>Synonyms</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const def = c.client_rates?.find((r) => r.is_default);
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
                      {c.address && <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{c.address.split('\n')[0]}</div>}
                    </td>
                    <td className="muted mono">{c.account_id ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(c.client_rates ?? []).map((r) => (
                          <span key={r.id} className={`chip ${r.is_default ? 'chip-accent' : ''}`}
                            style={r.is_default ? undefined : { background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                            {rateTypeLabel(r.rate_type)} · {money(r.rate_amount)}/{rateTypeUnit(r.rate_type)}
                          </span>
                        ))}
                        {!def && <span className="muted">—</span>}
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {c.synonyms.length ? c.synonyms.join(', ') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
                        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(c)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ClientForm
          initial={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
