import { useRef, type PointerEvent } from 'react';
import { clipEnd } from '../../core/clip';
import { transformAtTime } from '../../core/keyframes';
import { findClipLocation } from '../../core/project';
import type { Transform } from '../../core/types';
import { elementBox, hitTest } from '../../engine/render';
import { editTransform } from '../../store/editClip';
import { useEditorStore } from '../../store/editorStore';
import { useProject, useProjectStore } from '../../store/projectStore';

/** Aimantation au centre du cadre, en fraction du cadre. */
const CENTER_SNAP = 0.015;
const MIN_SCALE = 0.05;
const MAX_SCALE = 5;

type Gesture =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'resize'; centerX: number; centerY: number; distance: number; angle: number };

/**
 * Calque posé sur l'aperçu : toucher un élément le sélectionne, le glisser le déplace,
 * la poignée d'angle l'agrandit et le fait pivoter. Chaque geste est une seule étape d'annulation.
 */
export function SelectionOverlay({ width }: { width: number }) {
  const project = useProject();
  const playhead = useEditorStore((s) => s.playhead);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const gesture = useRef<Gesture | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const k = width / project.width;

  const location = selectedClipId ? findClipLocation(project, selectedClipId) : undefined;
  // Cadre de sélection : élément visuel présent au curseur, à son placement courant (keyframes comprises).
  const visible = location && location.track.kind !== 'audio' && location.clip.start <= playhead && playhead < clipEnd(location.clip);
  const box = visible ? elementBox(project, location.clip, transformAtTime(location.clip, playhead)) : null;

  const toProject = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return rect ? { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k } : { x: 0, y: 0 };
  };

  const onSurfaceDown = (e: PointerEvent<HTMLDivElement>) => {
    const { x, y } = toProject(e.clientX, e.clientY);
    const hit = hitTest(project, playhead, x, y);
    useEditorStore.getState().select(hit?.id ?? null);
    if (hit) startMove(e, hit.id);
  };

  const startMove = (e: PointerEvent<HTMLElement>, clipId: string) => {
    e.stopPropagation();
    surfaceRef.current?.setPointerCapture(e.pointerId);
    useEditorStore.getState().select(clipId);
    gesture.current = { kind: 'move', x: e.clientX, y: e.clientY };
    useProjectStore.getState().beginGesture();
  };

  const startResize = (e: PointerEvent<HTMLElement>) => {
    if (!box || !surfaceRef.current) return;
    e.stopPropagation();
    surfaceRef.current.setPointerCapture(e.pointerId);
    const rect = surfaceRef.current.getBoundingClientRect();
    const centerX = rect.left + box.cx * k;
    const centerY = rect.top + box.cy * k;
    gesture.current = {
      kind: 'resize',
      centerX,
      centerY,
      distance: Math.hypot(e.clientX - centerX, e.clientY - centerY),
      angle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
    };
    useProjectStore.getState().beginGesture();
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const clipId = useEditorStore.getState().selectedClipId;
    if (!g || !clipId) return;
    let update: (t: Transform) => Transform;
    if (g.kind === 'move') {
      const dx = (e.clientX - g.x) / (k * project.width);
      const dy = (e.clientY - g.y) / (k * project.height);
      const snap = (v: number) => (Math.abs(v - 0.5) < CENTER_SNAP ? 0.5 : v);
      update = (t) => ({ ...t, x: snap(t.x + dx), y: snap(t.y + dy) });
    } else {
      const distance = Math.hypot(e.clientX - g.centerX, e.clientY - g.centerY);
      const angle = Math.atan2(e.clientY - g.centerY, e.clientX - g.centerX);
      const ratio = g.distance > 0 ? distance / g.distance : 1;
      const turn = ((angle - g.angle) * 180) / Math.PI;
      update = (t) => ({
        ...t,
        scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * ratio)),
        rotation: ((t.rotation + turn + 540) % 360) - 180,
      });
    }
    editTransform(clipId, update);
  };

  const onUp = () => {
    if (!gesture.current) return;
    gesture.current = null;
    useProjectStore.getState().endGesture();
  };

  return (
    <div
      ref={surfaceRef}
      className="absolute inset-0 touch-none"
      onPointerDown={onSurfaceDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {box && location && (
        <div
          className="absolute cursor-move border-2 border-accent"
          style={{
            left: box.cx * k,
            top: box.cy * k,
            width: Math.max(16, box.width * k),
            height: Math.max(16, box.height * k),
            transform: `translate(-50%, -50%) rotate(${box.rotation}deg)`,
          }}
          onPointerDown={(e) => startMove(e, location.clip.id)}
          aria-label="Élément sélectionné : glissez pour le déplacer"
        >
          <div
            className="absolute -right-3 -bottom-3 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-white bg-accent shadow"
            onPointerDown={startResize}
            aria-label="Poignée : glissez pour agrandir et faire pivoter"
          />
        </div>
      )}
    </div>
  );
}
