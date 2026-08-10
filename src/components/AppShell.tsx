import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark';
import { FileIcon, ListIcon, SettingsIcon, UsersIcon } from './icons';
import { useAuth } from '../auth/AuthProvider';

export type Tab = 'invoice' | 'history' | 'clients' | 'business';

const NAV: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'invoice', label: 'New Invoice', icon: <FileIcon size={17} /> },
  { id: 'history', label: 'Invoices', icon: <ListIcon size={17} /> },
  { id: 'clients', label: 'Clients', icon: <UsersIcon size={17} /> },
  { id: 'business', label: 'Business', icon: <SettingsIcon size={17} /> },
];

export function AppShell({
  tab,
  onTab,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  children: ReactNode;
}) {
  const { session, signOut } = useAuth();

  return (
    <div className="app-shell">
      {/* Sidebar — collapses into a bottom tab bar on mobile, see index.css */}
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <Wordmark />
        </div>

        <nav className="app-nav">
          {NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                className={`app-nav-item${active ? ' active' : ''}`}
                onClick={() => onTab(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="muted" style={{ fontSize: 'var(--text-xs)', padding: '0 var(--s-3) var(--s-2)' }}>
            {session?.user.email}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut} style={{ width: '100%', justifyContent: 'flex-start' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="app-main">{children}</main>
    </div>
  );
}
