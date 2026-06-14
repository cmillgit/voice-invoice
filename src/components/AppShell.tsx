import type { ReactNode } from 'react';
import { Wordmark } from './Wordmark';
import { FileIcon, UsersIcon } from './icons';
import { useAuth } from '../auth/AuthProvider';

export type Tab = 'invoice' | 'clients';

const NAV: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'invoice', label: 'New Invoice', icon: <FileIcon size={17} /> },
  { id: 'clients', label: 'Clients', icon: <UsersIcon size={17} /> },
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
    <div style={{ display: 'grid', gridTemplateColumns: '232px 1fr', height: '100%' }}>
      {/* Sidebar */}
      <aside
        style={{
          borderRight: '1px solid var(--line)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--s-4)',
        }}
      >
        <div style={{ padding: 'var(--s-2) var(--s-2) var(--s-5)' }}>
          <Wordmark />
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--s-3)',
                  height: 38,
                  padding: '0 var(--s-3)',
                  border: 0,
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: active ? 600 : 500,
                  textAlign: 'left',
                  transition: 'background var(--dur) var(--ease)',
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: 'var(--s-3)' }}>
          <div className="muted" style={{ fontSize: 'var(--text-xs)', padding: '0 var(--s-3) var(--s-2)' }}>
            {session?.user.email}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut} style={{ width: '100%', justifyContent: 'flex-start' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ overflow: 'auto' }}>{children}</main>
    </div>
  );
}
