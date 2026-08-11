import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginScreen } from './auth/LoginScreen';
import { AppShell, type Tab } from './components/AppShell';
import { InvoicePage } from './features/invoice/InvoicePage';
import { InvoiceHistoryPage } from './features/invoices-history/InvoiceHistoryPage';
import { ClientsPage } from './features/clients/ClientsPage';
import { BusinessSettingsPage } from './features/business/BusinessSettingsPage';

function AuthedApp() {
  const { session, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('invoice');
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);

  if (loading) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100%' }} className="muted">Loading…</div>;
  }
  if (!session) return <LoginScreen />;

  function handleNavTab(t: Tab) {
    if (t === 'invoice') setEditInvoiceId(null); // a plain nav click always starts a fresh invoice
    setTab(t);
  }
  function handleEditInvoice(id: string) {
    setEditInvoiceId(id);
    setTab('invoice');
  }

  return (
    <AppShell tab={tab} onTab={handleNavTab}>
      {tab === 'invoice' && (
        <InvoicePage
          key={editInvoiceId ?? 'new'}
          invoiceId={editInvoiceId}
          onFinishEditing={() => setEditInvoiceId(null)}
        />
      )}
      {tab === 'history' && <InvoiceHistoryPage onEditInvoice={handleEditInvoice} />}
      {tab === 'clients' && <ClientsPage />}
      {tab === 'business' && <BusinessSettingsPage />}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}
