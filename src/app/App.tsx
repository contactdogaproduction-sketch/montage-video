import { useEffect } from 'react';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { startSession, useSessionStore } from '../features/projects/session';
import { Timeline } from '../features/timeline/Timeline';
import { useProjectStore } from '../store/projectStore';
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
 * Au lancement, le dernier projet enregistré sur l'appareil est rouvert.
 */
export function App() {
  useShortcuts();
  const status = useSessionStore((s) => s.status);
  const projectsOpen = useSessionStore((s) => s.projectsOpen);
  const projectId = useProjectStore((s) => s.history.present.id);

  useEffect(() => {
    void startSession();
  }, []);

  if (status === 'loading') {
    return <div className="flex h-dvh items-center justify-center bg-white text-sm text-neutral-500">Ouverture du projet…</div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col bg-neutral-50 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Nouveau lecteur à chaque projet ouvert (libère les vidéos du projet précédent). */}
          <PreviewPanel key={projectId} />
          <PlaybackBar />
        </div>
        <Inspector />
      </main>
      <Toolbar />
      <div className="pb-[env(safe-area-inset-bottom)]">
        <Timeline />
      </div>
      {projectsOpen && <ProjectsScreen />}
      <Toaster />
      <UpdatePrompt />
    </div>
  );
}
