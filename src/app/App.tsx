import { Timeline } from '../features/timeline/Timeline';
import { Toaster } from '../ui/Toaster';
import { Inspector } from './Inspector';
import { PlaybackBar } from './PlaybackBar';
import { PreviewPanel } from './PreviewPanel';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import { UpdatePrompt } from './UpdatePrompt';
import { useShortcuts } from './useShortcuts';

/**
 * Mise en page mobile d'abord : aperçu en haut, réglages de l'élément sélectionné,
 * barre d'outils au milieu, timeline en bas. Sur grand écran, les réglages passent à droite de l'aperçu.
 */
export function App() {
  useShortcuts();
  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col bg-neutral-50 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          <PreviewPanel />
          <PlaybackBar />
        </div>
        <Inspector />
      </main>
      <Toolbar />
      <div className="pb-[env(safe-area-inset-bottom)]">
        <Timeline />
      </div>
      <Toaster />
      <UpdatePrompt />
    </div>
  );
}
