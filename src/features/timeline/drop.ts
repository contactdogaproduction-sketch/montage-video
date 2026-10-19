import { findClipLocation, moveClip, type MoveTarget } from '../../core/project';
import { snapMove, snapPoints, type SnappedMove } from '../../core/snap';
import type { Ms, Project } from '../../core/types';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { getProject, useProjectStore } from '../../store/projectStore';
import { notify } from '../../ui/notify';
import { SNAP_PX } from '../cut/useTrimHandle';
import { useDragStore, type ClipDrag } from './dragStore';

/** Position (aimantée) du clip glissé. */
export function dragPosition(project: Project, drag: ClipDrag): SnappedMove | null {
  const location = findClipLocation(project, drag.clipId);
  if (!location) return null;
  const { timeAtClientX } = useDragStore.getState();
  const { playhead, pxPerSecond } = useEditorStore.getState();
  const raw = Math.max(0, timeAtClientX(drag.clientX - drag.offsetX));
  const points = snapPoints(project, drag.clipId, playhead);
  return snapMove(raw, location.clip.duration, points, (SNAP_PX * 1000) / pxPerSecond);
}

/** Cible sous le pointeur : une piste (`data-track-id`) ou la zone « nouvelle piste » (`data-new-track`). */
function targetAt(clientX: number, clientY: number): MoveTarget | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.trackId) return { trackId: el.dataset.trackId };
    if (el.dataset.newTrack !== undefined) return { newTrackId: createId() };
  }
  return null;
}

/** Dépose le clip glissé : une seule étape d'annulation. */
export function dropClip(drag: ClipDrag): void {
  const project = getProject();
  const target = targetAt(drag.clientX, drag.clientY);
  const position = dragPosition(project, drag);
  if (!target || !position) return;
  const start: Ms = position.start;
  const next = moveClip(project, drag.clipId, target, start, createId());
  if (!next) {
    notify('Ce clip ne peut pas aller sur cette piste.');
    return;
  }
  useProjectStore.getState().commit(() => next);
}
