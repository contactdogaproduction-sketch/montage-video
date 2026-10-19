import { InstallSection } from '../features/install/InstallSection';
import { OfflineStatus } from '../features/install/OfflineStatus';
import { ModelDownloads } from '../features/subtitles/ModelDownloads';

/** Bas de l'écran « Mes projets » : installation de l'application et utilisation sans connexion. */
export function AppSection() {
  return (
    <section className="mt-8 flex flex-col gap-3 border-t border-neutral-200 pt-6" aria-label="Application">
      <h3 className="text-sm font-semibold text-neutral-900">Application</h3>
      <InstallSection />
      <OfflineStatus />
      <h3 className="mt-2 text-sm font-semibold text-neutral-900">Sous-titres sans connexion</h3>
      <p className="text-xs text-neutral-500">Téléchargez le modèle une fois (en Wi-Fi) pour pouvoir sous-titrer ensuite sans réseau.</p>
      <ModelDownloads />
    </section>
  );
}
