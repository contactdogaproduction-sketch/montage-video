import { updateClip } from '../core/project';
import type { Clip, MediaClip, StickerClip, TextClip, Transform } from '../core/types';
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

/** Modifie le placement d'un élément visuel. */
export function editTransform(clipId: string, update: (transform: Transform) => Transform): void {
  editClip(clipId, (clip) => ({ ...clip, transform: update(clip.transform) }));
}
