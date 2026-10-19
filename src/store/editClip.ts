import { setTransformAt } from '../core/keyframes';
import { updateClip } from '../core/project';
import type { Clip, MediaClip, StickerClip, TextClip, Transform } from '../core/types';
import { useEditorStore } from './editorStore';
import { useProjectStore } from './projectStore';

/** Modifie un clip (dans le geste en cours s'il y en a un, sinon en une étape d'annulation). */
export function editClip(clipId: string, update: (clip: Clip) => Clip): void {
  useProjectStore.getState().apply((project) => updateClip(project, clipId, update));
}

export function editText(clipId: string, update: (clip: TextClip) => TextClip): void {
  editClip(clipId, (clip) => (clip.type === 'text' ? update(clip) : clip));
}

export function editSticker(clipId: string, update: (clip: StickerClip) => StickerClip): void {
  editClip(clipId, (clip) => (clip.type === 'sticker' ? update(clip) : clip));
}

export function editMedia(clipId: string, update: (clip: MediaClip) => MediaClip): void {
  editClip(clipId, (clip) => (clip.type === 'media' ? update(clip) : clip));
}

/**
 * Modifie le placement d'un élément visuel au curseur. Si l'élément a des keyframes,
 * la keyframe du curseur est modifiée ou créée (voir `setTransformAt`).
 */
export function editTransform(clipId: string, update: (transform: Transform) => Transform): void {
  const playhead = useEditorStore.getState().playhead;
  editClip(clipId, (clip) => setTransformAt(clip, playhead, update));
}
