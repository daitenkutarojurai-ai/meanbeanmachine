// Installing to the home screen and playing offline.

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = (): void => {
  for (const fn of [...listeners]) fn();
};

export function initPwa(): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // After the first screen is up, so caching never competes with loading the game.
    setTimeout(() => void navigator.serviceWorker.register('./sw.js').catch(() => {}), 3000);
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    changed();
  });
}

export const isInstalled = (): boolean => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** iPhones and iPads install from Safari's Share menu; there is no prompt to show. */
export const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPromptInstall = (): boolean => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  await d.prompt();
  const { outcome } = await d.userChoice;
  changed();
  return outcome === 'accepted';
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
