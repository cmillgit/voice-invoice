import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import type { Invoice } from '../../lib/types';
import { rateTypeUnit } from '../../lib/types';
import { money, qty, formatDate } from '../../lib/format';
import ramMark from '../../assets/ram-mark.png';

// One generic template (VISION §7), mirroring the on-screen InvoiceDocument.
// Real vector PDF — selectable text, crisp at any zoom.

const INK = '#211e1a';
const MUTED = '#6b6358';
const LINE = '#e4ddd0';
const ACCENT = '#143f2a';
const DANGER = '#a23e25';

const s = StyleSheet.create({
  page: { paddingVertical: 54, paddingHorizontal: 54, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  logoBlock: { alignItems: 'center' },
  logoMark: { height: 58, width: 'auto' },
  logoName: { fontSize: 16, fontFamily: 'Times-Bold', letterSpacing: 1, marginTop: 8 },
  logoPhone: { fontSize: 9, color: MUTED, marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 24 },
  number: { fontSize: 10, color: ACCENT, fontFamily: 'Helvetica-Bold' },
  dateLabel: { fontSize: 8, color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'right' },
  dateValue: { fontSize: 10, marginTop: 3, textAlign: 'right' },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 22 },
  label: { fontSize: 8, color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 },
  clientName: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  clientLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  jobBlock: { marginTop: 24, alignItems: 'center' },
  jobValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  // table
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 6, marginBottom: 2 },
  thText: { fontSize: 8, color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 9 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 80, textAlign: 'right' },
  cRate: { width: 90, textAlign: 'right' },
  cAmt: { width: 90, textAlign: 'right' },
  amtStrong: { fontFamily: 'Helvetica-Bold' },
  flag: { fontSize: 7, color: '#b45309', marginTop: 2 },
  // totals
  totals: { marginTop: 18, marginLeft: 'auto', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalMuted: { color: MUTED },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, marginTop: 4 },
  grandLabel: { fontSize: 13, fontFamily: 'Times-Bold' },
  grandValue: { fontSize: 17, fontFamily: 'Times-Bold', color: ACCENT },
  notes: { fontSize: 9, color: MUTED, marginTop: 4, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 32, left: 54, right: 54, textAlign: 'center' },
  footerLine: { fontSize: 8, color: MUTED },
});

export function InvoicePdf({ invoice }: { invoice: Invoice }) {
  const items = invoice.line_items ?? [];
  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>
      <Page size="LETTER" style={s.page}>
        {/* Logo header — RAM Painting & Construction mark, top-center. Wordmark text is
            the fixed brand lockup (not business_name, the fuller legal name used in the
            footer); phone is the live business phone. */}
        <View style={s.logoBlock}>
          <Image src={ramMark} style={s.logoMark} />
          <Text style={s.logoName}>RAM PAINTING</Text>
          {invoice.business_phone ? <Text style={s.logoPhone}>{invoice.business_phone}</Text> : null}
        </View>

        <View style={s.headerRow}>
          <View>
            <Text style={s.label}>Invoice</Text>
            <Text style={s.number}>#{invoice.invoice_number}</Text>
          </View>
          <View>
            <Text style={s.dateLabel}>Issue date</Text>
            <Text style={s.dateValue}>{formatDate(invoice.issue_date)}</Text>
          </View>
        </View>

        <View style={s.rule} />

        <View>
          <Text style={s.label}>Bill to</Text>
          <Text style={s.clientName}>{invoice.client_name}</Text>
          {invoice.client_address ? <Text style={s.clientLine}>{invoice.client_address}</Text> : null}
          {invoice.client_account_id ? <Text style={s.clientLine}>Account {invoice.client_account_id}</Text> : null}
        </View>

        {invoice.job_label ? (
          <View style={s.jobBlock}>
            <Text style={s.label}>Job</Text>
            <Text style={s.jobValue}>{invoice.job_label}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 26 }}>
          <View style={s.th}>
            <Text style={[s.thText, s.cDesc]}>Description</Text>
            <Text style={[s.thText, s.cQty]}>Qty</Text>
            <Text style={[s.thText, s.cRate]}>Rate</Text>
            <Text style={[s.thText, s.cAmt]}>Amount</Text>
          </View>
          {items.map((li) => (
            <View key={li.id} style={s.tr} wrap={false}>
              <View style={s.cDesc}>
                <Text>{li.description}</Text>
              </View>
              <Text style={s.cQty}>
                {li.is_deduction ? '—' : li.rate_type === 'flat' ? qty(li.quantity) : `${qty(li.quantity)} ${rateTypeUnit(li.rate_type)}`}
              </Text>
              <Text style={s.cRate}>{li.is_deduction ? '—' : money(li.rate_amount)}</Text>
              <Text style={[s.cAmt, s.amtStrong, li.is_deduction ? { color: DANGER } : {}]}>{money(li.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalMuted}>Subtotal</Text>
            <Text>{money(invoice.subtotal)}</Text>
          </View>
          {invoice.materials_total > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalMuted}>Materials</Text>
              <Text>{money(invoice.materials_total)}</Text>
            </View>
          )}
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Total</Text>
            <Text style={s.grandValue}>{money(invoice.total)}</Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={{ marginTop: 26 }}>
            <Text style={s.label}>Notes</Text>
            <Text style={s.notes}>{invoice.notes}</Text>
          </View>
        ) : null}

        {invoice.business_name ? (
          <View style={s.footer} fixed>
            <Text style={s.footerLine}>Make all checks payable to {invoice.business_name}</Text>
            <Text style={[s.footerLine, { marginTop: 2 }]}>Thank you for your business!</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export function buildPdfFilename(invoice: Invoice): string {
  const jobPart = (invoice.job_label?.trim() || invoice.invoice_number)
    .replace(/[\\/:*?"<>|]+/g, '-')   // filesystem-unsafe characters on Windows/macOS
    .replace(/\s+/g, ' ')
    .trim();
  return `RAM - ${jobPart} ${invoice.issue_date}.pdf`;
}

/** Build the PDF and trigger a browser download. */
export async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const blob = await pdf(<InvoicePdf invoice={invoice} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildPdfFilename(invoice);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
