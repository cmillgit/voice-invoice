import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { Invoice, Client, LineItem } from './types'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 11, color: '#111' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subheader: { fontSize: 11, color: '#666', marginBottom: 24 },
  section: { marginBottom: 16 },
  label: { fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  value: { fontSize: 11 },
  table: { marginTop: 20 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 7,
  },
  tableHeader: { backgroundColor: '#f5f5f5', fontWeight: 'bold', paddingHorizontal: 4 },
  col1: { flex: 3, paddingHorizontal: 4 },
  col2: { flex: 1, textAlign: 'right', paddingHorizontal: 4 },
  col3: { flex: 1, textAlign: 'right', paddingHorizontal: 4 },
  col4: { flex: 1, textAlign: 'right', paddingHorizontal: 4 },
  totalsBlock: { marginTop: 12, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', marginTop: 4 },
  totalLabel: { width: 100, textAlign: 'right', paddingRight: 8 },
  totalValue: { width: 80, textAlign: 'right' },
  grandTotalRow: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111',
    paddingTop: 6,
  },
  grandTotalLabel: { width: 100, textAlign: 'right', paddingRight: 8, fontWeight: 'bold', fontSize: 13 },
  grandTotalValue: { width: 80, textAlign: 'right', fontWeight: 'bold', fontSize: 13 },
  notesSection: { marginTop: 32 },
})

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

function InvoiceDocument({ invoice, client }: { invoice: Invoice; client: Client }) {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Business header */}
        <Text style={styles.header}>Miller Painting</Text>
        <Text style={styles.subheader}>Invoice {invoice.invoice_number}</Text>

        {/* Bill To + Date */}
        <View style={{ flexDirection: 'row', marginBottom: 24 }}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.value}>{client.name}</Text>
            {client.address ? <Text style={styles.value}>{client.address}</Text> : null}
            <Text style={styles.value}>{client.email}</Text>
          </View>
          <View style={[styles.section, { flex: 1, alignItems: 'flex-end' }]}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{date}</Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.col1}>Description</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Rate</Text>
            <Text style={styles.col4}>Amount</Text>
          </View>
          {invoice.line_items.map((item: LineItem, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{fmt(item.rate)}</Text>
              <Text style={styles.col4}>{fmt(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmt(invoice.subtotal)}</Text>
          </View>
          {invoice.tax_rate > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalLabel}>
                Tax ({(invoice.tax_rate * 100).toFixed(1)}%)
              </Text>
              <Text style={styles.totalValue}>{fmt(invoice.tax_amount)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{fmt(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{invoice.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

export async function generateInvoicePDF(invoice: Invoice, client: Client): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <InvoiceDocument invoice={invoice} client={client} />
  )
  return Buffer.from(buffer)
}
