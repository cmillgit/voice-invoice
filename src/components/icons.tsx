// Minimal line icons (1.5px stroke, angular) — inline SVG, currentColor.

type P = { size?: number };
const base = (size = 16) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const MicIcon = ({ size }: P) => (
  <svg {...base(size)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
export const PauseIcon = ({ size }: P) => (
  <svg {...base(size)}><rect x="7" y="5" width="3.5" height="14" /><rect x="13.5" y="5" width="3.5" height="14" /></svg>
);
export const SendIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 12l16-8-6 16-3-6-7-2z" /></svg>
);
export const PlusIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const TrashIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" /></svg>
);
export const FileIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
);
export const UsersIcon = ({ size }: P) => (
  <svg {...base(size)}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 6.5a3 3 0 0 1 0 6M21 20c0-2.5-1.3-4-3.5-4.6" /></svg>
);
export const CheckIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12.5 10 17l9-10" /></svg>
);
export const FlagIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
);
