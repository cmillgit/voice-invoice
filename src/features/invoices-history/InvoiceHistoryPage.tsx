import { useEffect, useState } from 'react';
import type { Invoice } from '../../lib/types';
import { money, formatDate } from '../../lib/format';
import { listInvoices } from './api';
import { InvoiceDocument } from '../invoice/InvoiceDocument';
import { DownloadIcon } from '../../components/icons';

/**
 * Browse past invoices. Flagged as missing in VISION §5/§10 — until now, an issued
 * invoice was a real database row with no way to see it again in the app.
 */
export function InvoiceHistoryPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

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

  return (
    <div style={{ padding: 'var(--s-6)', maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--s-5)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)' }}>Invoices</h1>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--s-1)' }}>
          Every issued invoice. Click one to review it or download the PDF again.
        </p>
      </header>

      {error && (
        <div className="card" style={{ padding: 'var(--s-4)', color: 'var(--danger)', marginBottom: 'var(--s-4)' }}>
          {error}
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
          <table className="table" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Client</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(inv)}>
                  <td className="mono">{inv.invoice_number}</td>
                  <td className="tnum">{formatDate(inv.issue_date)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{inv.client_name}</td>
                  <td className="num tnum" style={{ fontWeight: 600 }}>{money(inv.total)}</td>
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
              <button className="btn btn-primary" onClick={() => downloadPdf(selected)} disabled={pdfBusy}>
                <DownloadIcon size={16} /> {pdfBusy ? 'Preparing…' : 'Download PDF'}
              </button>
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
