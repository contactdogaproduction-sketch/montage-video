import { create } from 'zustand';

/** Événement non standard des navigateurs Chrome / Edge / Android : proposer l'installation. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'chromium' | 'other';

interface InstallState {
  /** Installation proposée par le navigateur (Chrome, Edge, Android), si disponible. */
  prompt: InstallPromptEvent | null;
  installed: boolean;
}

/** L'app tourne-t-elle déjà comme application installée (écran d'accueil, fenêtre d'app) ? */
function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export const useInstallStore = create<InstallState>()(() => ({ prompt: null, installed: isStandalone() }));

/** À appeler au démarrage : le navigateur n'émet l'événement qu'une fois, très tôt. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    useInstallStore.setState({ prompt: event as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstallStore.setState({ installed: true, prompt: null }));
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  return /Chrome|Chromium|Edg\//.test(ua) ? 'chromium' : 'other';
}

/** Ouvre la fenêtre d'installation du navigateur ; renvoie vrai si l'utilisateur a accepté. */
export async function promptInstall(): Promise<boolean> {
  const { prompt } = useInstallStore.getState();
  if (!prompt) return false;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  useInstallStore.setState({ prompt: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}
