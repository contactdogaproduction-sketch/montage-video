import { useRef, type PointerEvent } from 'react';
import { clipEnd } from '../../core/clip';
import { getMainTrack, getMedia, replaceTrack } from '../../core/project';
import { findClip, trimClipInTrack, type TrimEdge } from '../../core/track';
import { useEditorStore } from '../../store/editorStore';
import { getProject, useProjectStore } from '../../store/projectStore';

/**
 * Poignée de trim : glisser le bord d'un clip. Tout le geste forme une seule étape d'annulation,
 * et le curseur suit le bord pour montrer l'image de coupe dans l'aperçu.
 */
export function useTrimHandle(clipId: string, edge: TrimEdge) {
  const startX = useRef<number | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    useEditorStore.getState().setPlaying(false);
    useProjectStore.getState().beginGesture();
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (startX.current === null) return;
    const delta = ((e.clientX - startX.current) * 1000) / useEditorStore.getState().pxPerSecond;
    useProjectStore.getState().updateGesture((base) => {
      const clip = findClip(getMainTrack(base), clipId);
      if (!clip) return base;
      const media = getMedia(base, clip.mediaId);
      return replaceTrack(base, trimClipInTrack(getMainTrack(base), clipId, edge, delta, media));
    });
    const trimmed = findClip(getMainTrack(getProject()), clipId);
    if (trimmed) useEditorStore.getState().setPlayhead(edge === 'start' ? trimmed.start : clipEnd(trimmed) - 1);
  };

  const finish = () => {
    if (startX.current === null) return;
    startX.current = null;
    useProjectStore.getState().endGesture();
  };

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish };
}
