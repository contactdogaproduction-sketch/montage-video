import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { notify } from '../ui/notify';

/**
 * Application installable (PWA) : signale quand elle est prête hors ligne et propose
 * les mises à jour, appliquées seulement quand l'utilisateur le décide.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    notify('L’application est prête à fonctionner hors ligne.');
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="status">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
        <span className="flex-1">Une nouvelle version de l’application est disponible.</span>
        <button type="button" onClick={() => setNeedRefresh(false)} className="rounded-lg px-2 py-1 text-neutral-300 hover:text-white">
          Plus tard
        </button>
        <button type="button" onClick={() => void updateServiceWorker(true)} className="rounded-lg bg-accent px-3 py-1.5 font-semibold">
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
