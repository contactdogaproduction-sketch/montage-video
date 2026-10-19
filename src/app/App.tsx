import { CutTools } from '../features/cut/CutTools';
import { ImportButton } from '../features/import/ImportButton';
import { Timeline } from '../features/timeline/Timeline';
import { Toaster } from '../ui/Toaster';
import { PlaybackBar } from './PlaybackBar';
import { PreviewPanel } from './PreviewPanel';
import { TopBar } from './TopBar';
import { useShortcuts } from './useShortcuts';

/** Mise en page mobile d'abord : aperçu en haut, outils au milieu, timeline en bas. */
export function App() {
  useShortcuts();
  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col bg-neutral-50">
        <PreviewPanel />
        <PlaybackBar />
      </main>
      <nav className="flex justify-center gap-1 overflow-x-auto border-t border-neutral-200 bg-white px-2 py-1" aria-label="Outils">
        <ImportButton />
        <CutTools />
      </nav>
      <div className="pb-[env(safe-area-inset-bottom)]">
        <Timeline />
      </div>
      <Toaster />
    </div>
  );
}
