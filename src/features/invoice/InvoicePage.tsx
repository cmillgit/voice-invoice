import { useEffect, useMemo, useRef, useState } from 'react';
import type { BusinessProfile, Client, DraftLineItem, Invoice, InvoiceDraft, RateType } from '../../lib/types';
import { RATE_TYPES, rateTypeUnit } from '../../lib/types';
import { listClients } from '../clients/api';
import { getBusinessProfile } from '../business/api';
import { lineAmount, subtotal, invoiceTotal } from '../../lib/calc';
import { money, todayISO } from '../../lib/format';
import { saveInvoice, getInvoice } from './api';
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
  job_label: null,
  notes: null,
});

function draftFromInvoice(inv: Invoice): InvoiceDraft {
  return {
    client_id: inv.client_id,
    client_name: inv.client_name,
    client_address: inv.client_address,
    client_account_id: inv.client_account_id,
    issue_date: inv.issue_date,
    line_items: [...(inv.line_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((li) => ({
        description: li.description,
        rate_type: li.rate_type,
        quantity: li.quantity,
        rate_amount: li.rate_amount,
        is_flagged: li.is_flagged,
        flag_note: li.flag_note,
        is_deduction: li.is_deduction,
      })),
    materials_total: inv.materials_total,
    job_label: inv.job_label,
    notes: inv.notes,
  };
}

interface InvoicePageProps {
  invoiceId?: string | null;
  onFinishEditing?: () => void;
}

export function InvoicePage({ invoiceId, onFinishEditing }: InvoicePageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft>(emptyDraft);
  const [loading, setLoading] = useState(!!invoiceId);
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loadedStatus, setLoadedStatus] = useState<'draft' | 'issued' | null>(null);
  const [savedNumber, setSavedNumber] = useState<string | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listClients().then(setClients).catch(() => {}); }, []);
  useEffect(() => { getBusinessProfile().then(setBusinessProfile).catch(() => {}); }, []);

  useEffect(() => {
    // `invoiceId` is stable for the lifetime of this component instance — App.tsx
    // remounts InvoicePage (via `key`) whenever the loaded invoice changes — so this
    // only ever runs once per mount, and `loading`'s initial value already accounts
    // for it (no separate setLoading(true) needed here).
    if (!invoiceId) return;
    let cancelled = false;
    getInvoice(invoiceId)
      .then((inv) => {
        if (cancelled) return;
        setDraft(draftFromInvoice(inv));
        setCurrentId(inv.id);
        setLoadedStatus(inv.status);
        setSavedNumber(inv.invoice_number);
        setSavedInvoice(inv);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load invoice.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invoiceId]);

  // Once issued, an invoice only locks if it was *just* issued in this brand-new
  // compose session (no `invoiceId` prop — you never left this screen). Reopening an
  // already-issued invoice via the deliberate history "Edit" action (`invoiceId` set)
  // stays editable — that's the whole point of that button.
  const locked = loadedStatus === 'issued' && !invoiceId;

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

  /** Deductions (holdbacks) are manually toggled, never voice/agent-produced — see VISION §5. */
  function toggleDeduction(i: number, isDeduction: boolean) {
    updateLineItem(i, isDeduction
      ? { is_deduction: true, rate_type: 'flat', quantity: 1, rate_amount: 0 }
      : { is_deduction: false, rate_amount: 0 });
  }

  const sub = useMemo(() => subtotal(draft.line_items), [draft.line_items]);
  const total = useMemo(() => invoiceTotal(draft), [draft]);

  const lineItemValid = (li: DraftLineItem) =>
    !!li.description.trim() && li.quantity > 0 && (li.is_deduction ? li.rate_amount < 0 : li.rate_amount > 0);

  const canApprove =
    !!draft.client_id &&
    draft.line_items.length > 0 &&
    draft.line_items.every(lineItemValid);

  async function persist(status: 'draft' | 'issued') {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveInvoice(draft, businessProfile, { id: currentId, status });
      setCurrentId(saved.id);
      setLoadedStatus(saved.status);
      setSavedNumber(saved.invoice_number);
      setSavedInvoice(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  }

  function saveDraft() {
    return persist('draft');
  }
  function approve() {
    return persist('issued');
  }

  async function downloadPdf() {
    if (!savedInvoice) return;
    setPdfBusy(true);
    try {
      // Lazy-load react-pdf so it stays out of the initial bundle.
      const { downloadInvoicePdf } = await import('./InvoicePdf');
      await downloadInvoicePdf(savedInvoice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  function startNew() {
    if (invoiceId) {
      // Editing an existing invoice — let the parent clear editInvoiceId, which
      // changes this component's `key` and forces a clean remount.
      onFinishEditing?.();
      return;
    }
    // Already composing a brand-new invoice (editInvoiceId is already null, so a
    // remount wouldn't be triggered) — reset local state directly instead.
    setDraft(emptyDraft());
    setCurrentId(null);
    setLoadedStatus(null);
    setSavedNumber(null);
    setSavedInvoice(null);
    setError(null);
  }

  const docLineItems = draft.line_items.map((li) => ({ ...li, amount: lineAmount(li) }));

  if (loading) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100%' }} className="muted">Loading…</div>;
  }

  return (
    <div className="invoice-page-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 460px) 1fr', height: '100%' }}>
      {/* Left — compose */}
      <div className="invoice-page-compose" style={{ borderRight: '1px solid var(--line)', overflow: 'auto', padding: 'var(--s-6)', display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)' }}>{invoiceId ? 'Edit invoice' : 'New invoice'}</h1>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--s-1)' }}>
            Dictate the work, then review the document and approve.
          </p>
        </div>

        {/* Voice compose */}
        <ComposePanel disabled={locked} onUtterance={handleUtterance} />

        {/* Client */}
        <div className="field">
          <label className="label">Client</label>
          <select className="select" value={draft.client_id ?? ''} disabled={locked}
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

        {/* Job / project — a real field on real invoices, distinct from freeform notes */}
        <div className="field">
          <label className="label">Job / project</label>
          <input className="input" placeholder="e.g. 123 Main St, or the Jaeman Way job" value={draft.job_label ?? ''} disabled={locked}
            onChange={(e) => setDraft((d) => ({ ...d, job_label: e.target.value || null }))} />
        </div>

        {/* Line items */}
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="label">Line items</label>
            <button className="btn btn-ghost btn-sm" onClick={addLineItem} disabled={!draft.client_id || locked}>
              <PlusIcon size={14} /> Add
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
            {draft.line_items.map((li, i) => (
              <div key={i} className="card" style={{ padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
                  <input className="input" placeholder="Description" value={li.description} disabled={locked}
                    onChange={(e) => updateLineItem(i, { description: e.target.value })} />
                  <button className="btn btn-ghost btn-sm" onClick={() => removeLineItem(i)} disabled={locked} aria-label="Remove">
                    <TrashIcon size={14} />
                  </button>
                </div>
                {li.is_deduction ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="muted">Deduction of $</span>
                    <input className="input tnum" type="number" min="0" step="0.01" placeholder="Amount" style={{ flex: 1 }}
                      value={li.rate_amount ? Math.abs(li.rate_amount) : ''} disabled={locked}
                      onChange={(e) => updateLineItem(i, { rate_amount: -Math.abs(parseFloat(e.target.value) || 0) })} />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1fr', gap: 'var(--s-2)' }}>
                    <select className="select" value={li.rate_type} disabled={locked}
                      onChange={(e) => updateLineItem(i, { rate_type: e.target.value as RateType })}>
                      {RATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input className="input tnum" type="number" min="0" step="0.01" placeholder={`Qty (${rateTypeUnit(li.rate_type)})`}
                      value={li.quantity || ''} disabled={locked}
                      onChange={(e) => updateLineItem(i, { quantity: parseFloat(e.target.value) || 0 })} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="muted">$</span>
                      <input className="input tnum" type="number" min="0" step="0.01" placeholder="Rate"
                        value={li.rate_amount || ''} disabled={locked}
                        onChange={(e) => updateLineItem(i, { rate_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                    <input type="checkbox" checked={!!li.is_deduction} disabled={locked}
                      onChange={(e) => toggleDeduction(i, e.target.checked)} />
                    Deduction (e.g. holdback)
                  </label>
                  <div className="tnum" style={{ fontSize: 'var(--text-xs)', color: li.is_deduction ? 'var(--danger)' : 'var(--muted)' }}>
                    = {money(lineAmount(li))}
                  </div>
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
              <input className="input tnum" type="number" min="0" step="0.01" value={draft.materials_total || ''} disabled={locked}
                onChange={(e) => setDraft((d) => ({ ...d, materials_total: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="field">
            <label className="label">Issue date</label>
            <input className="input" type="date" value={draft.issue_date} disabled={locked}
              onChange={(e) => setDraft((d) => ({ ...d, issue_date: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label className="label">Notes</label>
          <textarea className="textarea" value={draft.notes ?? ''} disabled={locked}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || null }))} />
        </div>
      </div>

      {/* Right — preview + approval */}
      <div className="invoice-page-preview" style={{ overflow: 'auto', padding: 'var(--s-6)', background: 'var(--canvas)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          {savedNumber && (
            <div className="card" style={{ padding: 'var(--s-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderColor: 'var(--ok)', background: '#f0fbf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ok)' }}>
                <CheckIcon size={18} />
                <span style={{ fontWeight: 600 }}>
                  {loadedStatus === 'issued' ? `Invoice #${savedNumber} issued.` : `Draft #${savedNumber} saved.`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
                <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfBusy}>
                  <FileIcon size={16} /> {pdfBusy ? 'Preparing…' : 'Download PDF'}
                </button>
                <button className="btn" onClick={startNew}>New invoice</button>
              </div>
            </div>
          )}

          {!locked && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Review the document, then save a draft or approve to issue it.
              </span>
              <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
                <button className="btn" onClick={saveDraft} disabled={saving}
                  style={{ height: 42, padding: '0 var(--s-4)' }}>
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button className="btn btn-primary" onClick={approve} disabled={!canApprove || saving}
                  style={{ height: 42, padding: '0 var(--s-5)' }}>
                  <CheckIcon size={16} /> {saving ? 'Saving…' : 'Approve & issue'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="card" style={{ padding: 'var(--s-3)', color: 'var(--danger)' }}>{error}</div>}
          {!canApprove && !locked && (
            <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              To issue: select a client and add at least one line item with a description, quantity, and rate.
            </div>
          )}

          <InvoiceDocument
            number={savedNumber}
            issueDate={draft.issue_date}
            businessName={businessProfile?.name ?? null}
            businessAddress={businessProfile?.address ?? null}
            businessPhone={businessProfile?.phone ?? null}
            clientName={draft.client_name}
            clientAddress={draft.client_address}
            clientAccountId={draft.client_account_id}
            lineItems={docLineItems}
            materialsTotal={draft.materials_total}
            subtotal={sub}
            total={total}
            jobLabel={draft.job_label}
            notes={draft.notes}
          />
        </div>
      </div>
    </div>
  );
}
