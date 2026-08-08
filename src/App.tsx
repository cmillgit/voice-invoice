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

  if (loading) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100%' }} className="muted">Loading…</div>;
  }
  if (!session) return <LoginScreen />;

  return (
    <AppShell tab={tab} onTab={setTab}>
      {tab === 'invoice' && <InvoicePage />}
      {tab === 'history' && <InvoiceHistoryPage />}
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
