import { clipEnd } from '../../core/clip';
import { findClipLocation, moveClip, trimClipInProject } from '../../core/project';
import type { Clip } from '../../core/types';
import { createId } from '../../store/createId';
import { useProjectStore } from '../../store/projectStore';
import { SecondsField } from '../../ui/controls';

/** Début et fin d'un clip, en secondes (texte, sticker). */
export function ClipTiming({ clip }: { clip: Clip }) {
  const setStart = (ms: number) => {
    useProjectStore.getState().commit((project) => {
      const location = findClipLocation(project, clip.id);
      if (!location) return project;
      return moveClip(project, clip.id, { trackId: location.track.id }, ms, createId()) ?? project;
    });
  };
  const setEnd = (ms: number) => {
    useProjectStore.getState().commit((project) => trimClipInProject(project, clip.id, 'end', ms - clipEnd(clip)));
  };
  return (
    <div className="flex gap-3">
      <SecondsField label="Début (s)" value={clip.start} onCommit={setStart} />
      <SecondsField label="Fin (s)" value={clipEnd(clip)} onCommit={setEnd} />
    </div>
  );
}
