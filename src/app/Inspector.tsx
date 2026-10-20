import type { ReactNode } from 'react';
import { findClipLocation, getMainTrack } from '../core/project';
import type { Project } from '../core/types';
import { AudioPanel } from '../features/audio/AudioPanel';
import { BackgroundPanel } from '../features/background/BackgroundPanel';
import { FilterPanel } from '../features/filters/FilterPanel';
import { OverlayPanel } from '../features/overlay/OverlayPanel';
import { StickerPanel } from '../features/stickers/StickerPanel';
import { TextPanel } from '../features/text/TextPanel';
import { SpeedPanel } from '../features/speed/SpeedPanel';
import { TransitionPanel } from '../features/transitions/TransitionPanel';
import { useEditorStore } from '../store/editorStore';
import { useProject } from '../store/projectStore';
import { CloseIcon } from '../ui/icons';

/** Titre et réglages du clip sélectionné, ou `null` s'il n'a pas de réglages. */
function panelFor(project: Project, clipId: string): { title: string; content: ReactNode } | null {
  const location = findClipLocation(project, clipId);
  if (!location) return null;
  const { track, clip } = location;
  switch (clip.type) {
    case 'text':
      return { title: 'Texte', content: <TextPanel clip={clip} /> };
    case 'sticker':
      return { title: 'Sticker', content: <StickerPanel clip={clip} /> };
    case 'media': {
      const media = project.media[clip.mediaId];
      if (!media) return null;
      const visual = media.kind !== 'audio' ? <OverlayPanel clip={clip} overlay={track.kind === 'overlay'} /> : null;
      const filter = media.kind !== 'audio' ? <FilterPanel clip={clip} /> : null;
      const background = media.kind !== 'audio' ? <BackgroundPanel clip={clip} overlay={track.kind === 'overlay'} /> : null;
      const audio = media.kind !== 'image' ? <AudioPanel clip={clip} track={track} /> : null;
      const speed = media.kind !== 'image' ? <SpeedPanel clip={clip} /> : null;
      const title = media.kind === 'audio' ? 'Audio' : track.kind === 'overlay' ? 'Incrustation' : media.kind === 'image' ? 'Photo' : 'Vidéo';
      return {
        title,
        content: (
          <>
            {speed}
            {filter}
            {background}
            {visual}
            {audio}
          </>
        ),
      };
    }
  }
}

/** Réglages de la transition qui suit le clip `fromId` sur la piste principale. */
function transitionPanelFor(project: Project, fromId: string): { title: string; content: ReactNode } | null {
  const main = getMainTrack(project);
  const index = main.clips.findIndex((c) => c.id === fromId);
  const from = main.clips[index];
  const to = main.clips[index + 1];
  if (!from || !to || from.type !== 'media') return null;
  return { title: 'Transition', content: <TransitionPanel from={from} to={to} /> };
}

/** Vrai si le clip a des réglages à afficher. */
export function hasPanel(project: Project, clipId: string | null): boolean {
  return clipId !== null && panelFor(project, clipId) !== null;
}

/**
 * Réglages avancés, visibles seulement quand un élément est sélectionné :
 * feuille ouverte à la demande sur téléphone (l'aperçu reste visible au-dessus), colonne à droite sur grand écran.
 */
export function Inspector() {
  const project = useProject();
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedTransitionId = useEditorStore((s) => s.selectedTransitionId);
  const open = useEditorStore((s) => s.inspectorOpen);
  const panel = selectedClipId
    ? panelFor(project, selectedClipId)
    : selectedTransitionId
      ? transitionPanelFor(project, selectedTransitionId)
      : null;
  if (!panel) return null;

  return (
    <aside
      className={`${open ? 'fixed' : 'hidden'} inset-x-0 bottom-0 z-40 max-h-[55dvh] overflow-y-auto rounded-t-3xl border-t border-neutral-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:static lg:block lg:max-h-none lg:w-80 lg:rounded-none lg:border-t-0 lg:border-l lg:pb-4 lg:shadow-none`}
      aria-label={`Réglages : ${panel.title}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white py-3">
        <h2 className="text-sm font-semibold text-neutral-900">{panel.title}</h2>
        <button
          type="button"
          onClick={() => useEditorStore.getState().setInspectorOpen(false)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 lg:hidden"
        >
          <CloseIcon width={16} height={16} />
          Fermer
        </button>
      </div>
      <div className="flex flex-col gap-4">{panel.content}</div>
    </aside>
  );
}
