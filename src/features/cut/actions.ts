import { canSplitAt, clipEnd } from '../../core/clip';
import {
  duplicateClipInProject,
  findClipLocation,
  getMainTrack,
  projectDuration,
  removeClipFromProject,
  splitClipInProject,
} from '../../core/project';
import { findClipAt } from '../../core/track';
import type { Clip, Ms, Project } from '../../core/types';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { getProject, useProjectStore } from '../../store/projectStore';

export function selectedClip(project: Project, selectedClipId: string | null): Clip | undefined {
  return selectedClipId ? findClipLocation(project, selectedClipId)?.clip : undefined;
}

/**
 * Clip que « Couper » couperait au temps `t` : le clip sélectionné s'il est sous le curseur,
 * sinon celui de la piste principale.
 */
export function splittableClipAt(project: Project, selectedClipId: string | null, t: Ms): Clip | undefined {
  const selected = selectedClip(project, selectedClipId);
  const clip = selected && selected.start <= t && t < clipEnd(selected) ? selected : findClipAt(getMainTrack(project), t);
  return clip && canSplitAt(clip, t) ? clip : undefined;
}

export function splitAtPlayhead(): void {
  const editor = useEditorStore.getState();
  const clip = splittableClipAt(getProject(), editor.selectedClipId, editor.playhead);
  if (!clip) return;
  const newId = createId();
  useProjectStore.getState().commit((project) => splitClipInProject(project, clip.id, editor.playhead, newId) ?? project);
  editor.select(newId);
}

export function deleteSelected(): void {
  const editor = useEditorStore.getState();
  const clip = selectedClip(getProject(), editor.selectedClipId);
  if (!clip) return;
  useProjectStore.getState().commit((project) => removeClipFromProject(project, clip.id));
  editor.select(null);
  editor.setPlayhead(Math.min(editor.playhead, projectDuration(getProject())));
}

export function duplicateSelected(): void {
  const editor = useEditorStore.getState();
  const clip = selectedClip(getProject(), editor.selectedClipId);
  if (!clip) return;
  const newId = createId();
  const newTrackId = createId();
  useProjectStore.getState().commit((project) => duplicateClipInProject(project, clip.id, newId, newTrackId) ?? project);
  editor.select(newId);
}
