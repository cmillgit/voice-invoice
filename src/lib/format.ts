// Display formatting only. Never the source of truth for stored money —
// the database computes and stores authoritative totals (VISION §5).

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (n: number | null | undefined): string => USD.format(n ?? 0);

const QTY = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const qty = (n: number | null | undefined): string => QTY.format(n ?? 0);

export function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; render without timezone shifting
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
