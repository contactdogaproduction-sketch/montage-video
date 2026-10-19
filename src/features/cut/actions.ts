import { canSplitAt } from '../../core/clip';
import { getMainTrack, projectDuration, replaceTrack } from '../../core/project';
import { duplicateClipInTrack, findClip, findClipAt, removeClip, splitClipInTrack } from '../../core/track';
import type { Clip, Ms, Project } from '../../core/types';
import { createId } from '../../store/createId';
import { useEditorStore } from '../../store/editorStore';
import { getProject, useProjectStore } from '../../store/projectStore';

/** Clip que « Couper » couperait au temps `t`, s'il existe. */
export function splittableClipAt(project: Project, t: Ms): Clip | undefined {
  const clip = findClipAt(getMainTrack(project), t);
  return clip && canSplitAt(clip, t) ? clip : undefined;
}

export function selectedClip(project: Project, selectedClipId: string | null): Clip | undefined {
  return selectedClipId ? findClip(getMainTrack(project), selectedClipId) : undefined;
}

export function splitAtPlayhead(): void {
  const editor = useEditorStore.getState();
  const clip = splittableClipAt(getProject(), editor.playhead);
  if (!clip) return;
  const newId = createId();
  useProjectStore.getState().commit((project) => {
    const track = splitClipInTrack(getMainTrack(project), clip.id, editor.playhead, newId);
    return track ? replaceTrack(project, track) : project;
  });
  editor.select(newId);
}

export function deleteSelected(): void {
  const editor = useEditorStore.getState();
  const clip = selectedClip(getProject(), editor.selectedClipId);
  if (!clip) return;
  useProjectStore.getState().commit((project) => replaceTrack(project, removeClip(getMainTrack(project), clip.id)));
  editor.select(null);
  editor.setPlayhead(Math.min(editor.playhead, projectDuration(getProject())));
}

export function duplicateSelected(): void {
  const editor = useEditorStore.getState();
  const clip = selectedClip(getProject(), editor.selectedClipId);
  if (!clip) return;
  const newId = createId();
  useProjectStore.getState().commit((project) => {
    const track = duplicateClipInTrack(getMainTrack(project), clip.id, newId);
    return track ? replaceTrack(project, track) : project;
  });
  editor.select(newId);
}
