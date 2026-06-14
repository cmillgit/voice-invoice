import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { Wordmark } from '../components/Wordmark';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 'var(--s-4)' }}>
      <div className="card" style={{ width: 380, padding: 'var(--s-6)' }}>
        <div style={{ marginBottom: 'var(--s-5)' }}>
          <Wordmark />
          <p className="muted" style={{ marginTop: 'var(--s-2)', fontSize: 'var(--text-sm)' }}>
            Sign in to continue.
          </p>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</div>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}
            style={{ width: '100%', height: 42 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
