// Cross-platform "running as an installed app" detection, not tied to any one OS.
// iOS home-screen apps report via the non-standard `navigator.standalone`; every other
// platform (desktop Chrome/Edge installs, Android Chrome installs) supports the standard
// `(display-mode: standalone)` media query.
export function isStandalonePWA(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}
