import type { RateType } from '../../lib/types';
import { rateTypeUnit } from '../../lib/types';
import { money, qty, formatDate } from '../../lib/format';
import { FlagIcon } from '../../components/icons';

export interface DocLineItem {
  description: string;
  rate_type: RateType;
  quantity: number;
  rate_amount: number;
  amount: number;
  is_flagged?: boolean;
  flag_note?: string | null;
}

export interface DocProps {
  number: string | null; // null → DRAFT
  issueDate: string;
  clientName: string;
  clientAddress: string | null;
  clientAccountId: string | null;
  lineItems: DocLineItem[];
  materialsTotal: number;
  subtotal: number;
  total: number;
  notes: string | null;
}

/**
 * The invoice document — used for BOTH the live preview (point of approval, VISION §4.3)
 * and the finalized record. One generic template (VISION §7).
 */
export function InvoiceDocument(props: DocProps) {
  const draft = props.number === null;
  const empty = props.lineItems.length === 0 && props.materialsTotal === 0 && !props.clientName;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: 'var(--s-7)',
        minHeight: 560,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-6)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 680, letterSpacing: '-0.03em' }}>Invoice</div>
          <div className="mono" style={{ marginTop: 6, color: draft ? 'var(--faint)' : 'var(--accent-ink)', fontWeight: 600 }}>
            {draft ? 'DRAFT — not yet issued' : `#${props.number}`}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 'var(--text-sm)' }}>
          <div className="label" style={{ marginBottom: 4 }}>Issue date</div>
          <div className="tnum">{formatDate(props.issueDate)}</div>
        </div>
      </div>

      <hr className="divider" />

      {/* Bill to */}
      <div>
        <div className="label" style={{ marginBottom: 6 }}>Bill to</div>
        {props.clientName ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>{props.clientName}</div>
            {props.clientAddress && (
              <div className="muted" style={{ whiteSpace: 'pre-line', fontSize: 'var(--text-sm)', marginTop: 2 }}>
                {props.clientAddress}
              </div>
            )}
            {props.clientAccountId && (
              <div className="muted mono" style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
                Account {props.clientAccountId}
              </div>
            )}
          </>
        ) : (
          <div className="muted">No client selected</div>
        )}
      </div>

      {/* Line items table */}
      <table className="table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num" style={{ width: 90 }}>Qty</th>
            <th className="num" style={{ width: 120 }}>Rate</th>
            <th className="num" style={{ width: 120 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {props.lineItems.length === 0 ? (
            <tr><td colSpan={4} className="muted" style={{ padding: 'var(--s-5)', textAlign: 'center' }}>
              {empty ? 'Speak or enter the work performed to build this invoice.' : 'No line items yet.'}
            </td></tr>
          ) : (
            props.lineItems.map((li, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--ink)' }}>{li.description || <span className="muted">—</span>}</span>
                    {li.is_flagged && (
                      <span className="chip chip-flag" title={li.flag_note ?? 'Best-guess — please review'}>
                        <FlagIcon size={11} /> review
                      </span>
                    )}
                  </div>
                </td>
                <td className="num tnum">{qty(li.quantity)} {rateTypeUnit(li.rate_type)}</td>
                <td className="num tnum">{money(li.rate_amount)}</td>
                <td className="num tnum" style={{ fontWeight: 600 }}>{money(li.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginLeft: 'auto', width: 280, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        <Row label="Subtotal" value={money(props.subtotal)} />
        {props.materialsTotal > 0 && <Row label="Materials" value={money(props.materialsTotal)} />}
        <hr className="divider" style={{ margin: 'var(--s-1) 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 650, fontSize: 'var(--text-md)' }}>Total</span>
          <span className="tnum" style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{money(props.total)}</span>
        </div>
      </div>

      {props.notes && (
        <>
          <hr className="divider" />
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Notes</div>
            <div className="muted" style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-line' }}>{props.notes}</div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
      <span className="muted">{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
