import { useRef, type PointerEvent } from 'react';
import { clipEnd } from '../../core/clip';
import { findClipLocation, trimClipInProject } from '../../core/project';
import { snapPoints, snapValue } from '../../core/snap';
import type { Ms, Project } from '../../core/types';
import { isFreeTrack, type TrimEdge } from '../../core/track';
import { useEditorStore } from '../../store/editorStore';
import { getProject, useProjectStore } from '../../store/projectStore';

/** Distance d'aimantation, en pixels d'écran. */
export const SNAP_PX = 10;

/**
 * Poignée de trim : glisser le bord d'un clip. Tout le geste forme une seule étape d'annulation,
 * le bord s'aimante aux autres clips et le curseur le suit pour montrer l'image de coupe.
 */
export function useTrimHandle(clipId: string, edge: TrimEdge) {
  const gesture = useRef<{ x: number; edgeTime: Ms; points: Ms[] } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const location = findClipLocation(getProject(), clipId);
    if (!location) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const editor = useEditorStore.getState();
    editor.setPlaying(false);
    gesture.current = {
      x: e.clientX,
      edgeTime: edge === 'start' ? location.clip.start : clipEnd(location.clip),
      // Piste principale : la position des voisins dépend du trim, seule la règle sert d'aimant.
      points: isFreeTrack(location.track) ? snapPoints(getProject(), clipId, editor.playhead) : [],
    };
    useProjectStore.getState().beginGesture();
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const pxPerSecond = useEditorStore.getState().pxPerSecond;
    const raw = g.edgeTime + ((e.clientX - g.x) * 1000) / pxPerSecond;
    const snapped = snapValue(raw, g.points, (SNAP_PX * 1000) / pxPerSecond) ?? raw;
    const delta = snapped - g.edgeTime;
    useProjectStore.getState().updateGesture((base: Project) => trimClipInProject(base, clipId, edge, delta));
    const trimmed = findClipLocation(getProject(), clipId)?.clip;
    if (trimmed) useEditorStore.getState().setPlayhead(edge === 'start' ? trimmed.start : clipEnd(trimmed) - 1);
  };

  const finish = () => {
    if (!gesture.current) return;
    gesture.current = null;
    useProjectStore.getState().endGesture();
  };

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish };
}
