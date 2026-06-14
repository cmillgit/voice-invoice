import { useEffect, useMemo, useRef, useState } from 'react';
import type { Client, DraftLineItem, Invoice, InvoiceDraft, RateType } from '../../lib/types';
import { RATE_TYPES, rateTypeUnit } from '../../lib/types';
import { listClients } from '../clients/api';
import { lineAmount, subtotal, invoiceTotal } from '../../lib/calc';
import { money, todayISO } from '../../lib/format';
import { approveInvoice } from './api';
import { runAgentTurn, type Turn } from './agent';
import { InvoiceDocument } from './InvoiceDocument';
import { ComposePanel } from './ComposePanel';
import { CheckIcon, FileIcon, PlusIcon, TrashIcon } from '../../components/icons';

const emptyDraft = (): InvoiceDraft => ({
  client_id: null,
  client_name: '',
  client_address: null,
  client_account_id: null,
  issue_date: todayISO(),
  line_items: [],
  materials_total: 0,
  notes: null,
});

export function InvoicePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [draft, setDraft] = useState<InvoiceDraft>(emptyDraft);
  const [approving, setApproving] = useState(false);
  const [approvedNumber, setApprovedNumber] = useState<string | null>(null);
  const [approvedInvoice, setApprovedInvoice] = useState<Invoice | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listClients().then(setClients).catch(() => {}); }, []);

  // Keep a live ref so the async agent turn always sees the latest draft.
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  async function handleUtterance(utterance: string, conversation: Turn[]): Promise<string> {
    const { draft: nextDraft, agentMessage } = await runAgentTurn({
      utterance,
      conversation,
      clients,
      draft: draftRef.current,
    });
    setDraft(nextDraft);
    return agentMessage;
  }

  const selectedClient = clients.find((c) => c.id === draft.client_id) ?? null;

  function selectClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) { setDraft({ ...draft, client_id: null, client_name: '', client_address: null, client_account_id: null }); return; }
    setDraft((d) => ({
      ...d,
      client_id: c.id,
      client_name: c.name,
      client_address: c.address,
      client_account_id: c.account_id,
    }));
  }

  function defaultRateFor(type: RateType): number {
    const r = selectedClient?.client_rates?.find((x) => x.rate_type === type);
    return r?.rate_amount ?? 0;
  }

  function addLineItem() {
    const def = selectedClient?.client_rates?.find((r) => r.is_default);
    const rate_type = def?.rate_type ?? 'hourly';
    setDraft((d) => ({
      ...d,
      line_items: [...d.line_items, { description: '', rate_type, quantity: 1, rate_amount: def?.rate_amount ?? defaultRateFor(rate_type) }],
    }));
  }
  function updateLineItem(i: number, patch: Partial<DraftLineItem>) {
    setDraft((d) => ({
      ...d,
      line_items: d.line_items.map((li, idx) => {
        if (idx !== i) return li;
        const next = { ...li, ...patch };
        // when rate type changes, refill the rate from the client default for that type
        if (patch.rate_type && patch.rate_amount === undefined) next.rate_amount = defaultRateFor(patch.rate_type);
        return next;
      }),
    }));
  }
  function removeLineItem(i: number) {
    setDraft((d) => ({ ...d, line_items: d.line_items.filter((_, idx) => idx !== i) }));
  }

  const sub = useMemo(() => subtotal(draft.line_items), [draft.line_items]);
  const total = useMemo(() => invoiceTotal(draft), [draft]);

  const canApprove =
    !!draft.client_id &&
    draft.line_items.length > 0 &&
    draft.line_items.every((li) => li.description.trim() && li.quantity > 0 && li.rate_amount > 0);

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      const saved = await approveInvoice(draft);
      setApprovedNumber(saved.invoice_number);
      setApprovedInvoice(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save invoice.');
    } finally {
      setApproving(false);
    }
  }

  async function downloadPdf() {
    if (!approvedInvoice) return;
    setPdfBusy(true);
    try {
      // Lazy-load react-pdf so it stays out of the initial bundle.
      const { downloadInvoicePdf } = await import('./InvoicePdf');
      await downloadInvoicePdf(approvedInvoice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  function reset() {
    setDraft(emptyDraft());
    setApprovedNumber(null);
    setApprovedInvoice(null);
    setError(null);
  }

  const docLineItems = draft.line_items.map((li) => ({ ...li, amount: lineAmount(li) }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 460px) 1fr', height: '100%' }}>
      {/* Left — compose */}
      <div style={{ borderRight: '1px solid var(--line)', overflow: 'auto', padding: 'var(--s-6)', display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)' }}>New invoice</h1>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--s-1)' }}>
            Dictate the work, then review the document and approve.
          </p>
        </div>

        {/* Voice compose */}
        <ComposePanel disabled={!!approvedNumber} onUtterance={handleUtterance} />

        {/* Client */}
        <div className="field">
          <label className="label">Client</label>
          <select className="select" value={draft.client_id ?? ''} disabled={!!approvedNumber}
            onChange={(e) => selectClient(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {clients.length === 0 && (
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              No clients yet — add one in the Clients tab first.
            </span>
          )}
        </div>

        {/* Line items */}
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="label">Line items</label>
            <button className="btn btn-ghost btn-sm" onClick={addLineItem} disabled={!draft.client_id || !!approvedNumber}>
              <PlusIcon size={14} /> Add
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
            {draft.line_items.map((li, i) => (
              <div key={i} className="card" style={{ padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
                  <input className="input" placeholder="Description" value={li.description} disabled={!!approvedNumber}
                    onChange={(e) => updateLineItem(i, { description: e.target.value })} />
                  <button className="btn btn-ghost btn-sm" onClick={() => removeLineItem(i)} disabled={!!approvedNumber} aria-label="Remove">
                    <TrashIcon size={14} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1fr', gap: 'var(--s-2)' }}>
                  <select className="select" value={li.rate_type} disabled={!!approvedNumber}
                    onChange={(e) => updateLineItem(i, { rate_type: e.target.value as RateType })}>
                    {RATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input className="input tnum" type="number" min="0" step="0.01" placeholder={`Qty (${rateTypeUnit(li.rate_type)})`}
                    value={li.quantity || ''} disabled={!!approvedNumber}
                    onChange={(e) => updateLineItem(i, { quantity: parseFloat(e.target.value) || 0 })} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="muted">$</span>
                    <input className="input tnum" type="number" min="0" step="0.01" placeholder="Rate"
                      value={li.rate_amount || ''} disabled={!!approvedNumber}
                      onChange={(e) => updateLineItem(i, { rate_amount: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="muted tnum" style={{ textAlign: 'right', fontSize: 'var(--text-xs)' }}>
                  = {money(lineAmount(li))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Materials + meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
          <div className="field">
            <label className="label">Materials (lump sum)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="muted">$</span>
              <input className="input tnum" type="number" min="0" step="0.01" value={draft.materials_total || ''} disabled={!!approvedNumber}
                onChange={(e) => setDraft((d) => ({ ...d, materials_total: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="field">
            <label className="label">Issue date</label>
            <input className="input" type="date" value={draft.issue_date} disabled={!!approvedNumber}
              onChange={(e) => setDraft((d) => ({ ...d, issue_date: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label className="label">Notes</label>
          <textarea className="textarea" value={draft.notes ?? ''} disabled={!!approvedNumber}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || null }))} />
        </div>
      </div>

      {/* Right — preview + approval */}
      <div style={{ overflow: 'auto', padding: 'var(--s-6)', background: 'var(--canvas)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          {approvedNumber ? (
            <div className="card" style={{ padding: 'var(--s-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderColor: 'var(--ok)', background: '#f0fbf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ok)' }}>
                <CheckIcon size={18} />
                <span style={{ fontWeight: 600 }}>Invoice #{approvedNumber} saved.</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
                <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfBusy}>
                  <FileIcon size={16} /> {pdfBusy ? 'Preparing…' : 'Download PDF'}
                </button>
                <button className="btn" onClick={reset}>New invoice</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Review the document, then approve to issue it.
              </span>
              <button className="btn btn-primary" onClick={approve} disabled={!canApprove || approving}
                style={{ height: 42, padding: '0 var(--s-5)' }}>
                <CheckIcon size={16} /> {approving ? 'Saving…' : 'Approve & issue'}
              </button>
            </div>
          )}

          {error && <div className="card" style={{ padding: 'var(--s-3)', color: 'var(--danger)' }}>{error}</div>}
          {!canApprove && !approvedNumber && (
            <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              To issue: select a client and add at least one line item with a description, quantity, and rate.
            </div>
          )}

          <InvoiceDocument
            number={approvedNumber}
            issueDate={draft.issue_date}
            clientName={draft.client_name}
            clientAddress={draft.client_address}
            clientAccountId={draft.client_account_id}
            lineItems={docLineItems}
            materialsTotal={draft.materials_total}
            subtotal={sub}
            total={total}
            notes={draft.notes}
          />
        </div>
      </div>
    </div>
  );
}
