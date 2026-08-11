import { useEffect, useMemo, useState } from 'react';
import type { Invoice } from '../../lib/types';
import { money, formatDate } from '../../lib/format';
import { listInvoices, deleteInvoice } from './api';
import { InvoiceDocument } from '../invoice/InvoiceDocument';
import { DownloadIcon, TrashIcon } from '../../components/icons';

type SortKey = 'invoice_number' | 'issue_date' | 'client_name' | 'job_label' | 'total';
type SortDir = 'asc' | 'desc';

interface InvoiceHistoryPageProps {
  onEditInvoice: (id: string) => void;
}

/**
 * Browse past invoices, draft and issued. Flagged as missing in VISION §5/§10 — until
 * now, an issued invoice was a real database row with no way to see it again in the app.
 */
export function InvoiceHistoryPage({ onEditInvoice }: InvoiceHistoryPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('issue_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    listInvoices()
      .then(setInvoices)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load invoices.'))
      .finally(() => setLoading(false));
  }, []);

  async function downloadPdf(inv: Invoice) {
    setPdfBusy(true);
    try {
      const { downloadInvoicePdf } = await import('../invoice/InvoicePdf');
      await downloadInvoicePdf(inv);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) =>
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.client_name.toLowerCase().includes(q) ||
      (inv.job_label ?? '').toLowerCase().includes(q));
  }, [invoices, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortKey) {
        case 'total': av = a.total; bv = b.total; break;
        case 'issue_date': av = a.issue_date; bv = b.issue_date; break;
        case 'job_label': av = (a.job_label ?? '').toLowerCase(); bv = (b.job_label ?? '').toLowerCase(); break;
        case 'client_name': av = a.client_name.toLowerCase(); bv = b.client_name.toLowerCase(); break;
        default: av = a.invoice_number.toLowerCase(); bv = b.invoice_number.toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null;
    return <span className="muted"> {sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  function handleRowClick(inv: Invoice) {
    if (inv.status === 'draft') {
      onEditInvoice(inv.id);
    } else {
      setSelected(inv);
    }
  }

  async function handleDelete(inv: Invoice) {
    const label = inv.status === 'draft' ? `draft #${inv.invoice_number}` : `invoice #${inv.invoice_number}`;
    if (!confirm(`Delete ${label} for ${inv.client_name}? This cannot be undone.`)) return;
    try {
      await deleteInvoice(inv.id);
      setInvoices((all) => all.filter((i) => i.id !== inv.id));
      if (selected?.id === inv.id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete.');
    }
  }

  return (
    <div style={{ padding: 'var(--s-6)', maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--s-5)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)' }}>Invoices</h1>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--s-1)' }}>
          Every draft and issued invoice. Click a draft to keep editing it, or click an issued invoice to review it or download the PDF again.
        </p>
      </header>

      {error && (
        <div className="card" style={{ padding: 'var(--s-4)', color: 'var(--danger)', marginBottom: 'var(--s-4)' }}>
          {error}
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="field" style={{ marginBottom: 'var(--s-4)' }}>
          <input
            className="input"
            placeholder="Search by invoice #, client, or job…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="muted" style={{ padding: 'var(--s-6)' }}>Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="card" style={{ padding: 'var(--s-7)', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: 'var(--s-2)' }}>No invoices yet</p>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Approved invoices will show up here.
          </p>
        </div>
      ) : (
        <div className="card table-scroll">
          <table className="table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('invoice_number')}>Invoice #{sortIndicator('invoice_number')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('issue_date')}>Date{sortIndicator('issue_date')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('client_name')}>Client{sortIndicator('client_name')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('job_label')}>Job{sortIndicator('job_label')}</th>
                <th>Status</th>
                <th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('total')}>Total{sortIndicator('total')}</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((inv) => (
                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => handleRowClick(inv)}>
                  <td className="mono">{inv.invoice_number}</td>
                  <td className="tnum">{formatDate(inv.issue_date)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{inv.client_name}</td>
                  <td className="muted">{inv.job_label ?? '—'}</td>
                  <td>
                    {inv.status === 'draft' && (
                      <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>Draft</span>
                    )}
                  </td>
                  <td className="num tnum" style={{ fontWeight: 600 }}>{money(inv.total)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(inv)} aria-label="Delete">
                      <TrashIcon size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="modal-detail"
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(33,30,26,0.4)', display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)', placeItems: 'center', padding: 'var(--s-5)', zIndex: 50, overflow: 'auto' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
              <button className="btn" onClick={() => { onEditInvoice(selected.id); setSelected(null); }}>Edit</button>
              <button className="btn btn-primary" onClick={() => downloadPdf(selected)} disabled={pdfBusy}>
                <DownloadIcon size={16} /> {pdfBusy ? 'Preparing…' : 'Download PDF'}
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected)}>Delete</button>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>
            <InvoiceDocument
              number={selected.invoice_number}
              issueDate={selected.issue_date}
              businessName={selected.business_name}
              businessAddress={selected.business_address}
              businessPhone={selected.business_phone}
              clientName={selected.client_name}
              clientAddress={selected.client_address}
              clientAccountId={selected.client_account_id}
              lineItems={[...(selected.line_items ?? [])].sort((a, b) => a.position - b.position)}
              materialsTotal={selected.materials_total}
              subtotal={selected.subtotal}
              total={selected.total}
              jobLabel={selected.job_label}
              notes={selected.notes}
            />
          </div>
        </div>
      )}
    </div>
  );
}
