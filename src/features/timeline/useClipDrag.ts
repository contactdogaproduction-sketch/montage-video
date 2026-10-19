import { useEffect, useRef, type PointerEvent, type TouchEvent } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { dropClip } from './drop';
import { useDragStore } from './dragStore';

/** Déplacement minimal à la souris avant de commencer un glisser (px). */
const MOUSE_THRESHOLD = 4;
/** Durée de l'appui long qui attrape un clip au doigt (ms). */
const LONG_PRESS_MS = 400;
/** Au-delà de ce déplacement avant la fin de l'appui long, c'est un défilement (px). */
const TOUCH_TOLERANCE = 8;

/**
 * Glisser-déposer d'un clip. Souris : glisser directement. Doigt : appui long, pour laisser
 * le glisser simple faire défiler la timeline.
 */
export function useClipDrag(clipId: string) {
  const press = useRef<{ x: number; y: number; offsetX: number; active: boolean } | null>(null);
  const timer = useRef(0);
  const cleanupTouch = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      cleanupTouch.current?.();
    },
    [],
  );

  const begin = (clientX: number, clientY: number, offsetX: number) => {
    useEditorStore.getState().setPlaying(false);
    useEditorStore.getState().select(clipId);
    useDragStore.getState().setDrag({ clipId, offsetX, clientX, clientY });
  };

  const move = (clientX: number, clientY: number) => {
    const drag = useDragStore.getState().drag;
    if (drag) useDragStore.getState().setDrag({ ...drag, clientX, clientY });
  };

  const finish = (drop: boolean) => {
    const drag = useDragStore.getState().drag;
    useDragStore.getState().setDrag(null);
    press.current = null;
    if (drop && drag) dropClip(drag);
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    press.current = { x: e.clientX, y: e.clientY, offsetX: e.clientX - rect.left, active: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || e.pointerType !== 'mouse') return;
    if (!p.active) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < MOUSE_THRESHOLD) return;
      p.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      begin(e.clientX, e.clientY, p.offsetX);
    }
    move(e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || !press.current) return;
    const wasDragging = press.current.active;
    finish(wasDragging);
    if (wasDragging) {
      // Le clic qui suit un glisser ne doit pas être traité comme une sélection de la piste.
      e.currentTarget.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
    }
  };

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch || e.touches.length > 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    press.current = { x: touch.clientX, y: touch.clientY, offsetX: touch.clientX - rect.left, active: false };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const p = press.current;
      if (!p) return;
      p.active = true;
      navigator.vibrate?.(15);
      begin(p.x, p.y, p.offsetX);
      // Écouteurs non passifs : empêchent le défilement pendant le glisser.
      const onMove = (ev: globalThis.TouchEvent) => {
        const t = ev.touches[0];
        if (!t) return;
        ev.preventDefault();
        move(t.clientX, t.clientY);
      };
      const onEnd = (ev: globalThis.TouchEvent) => {
        cleanupTouch.current?.();
        finish(ev.type === 'touchend');
      };
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
      cleanupTouch.current = () => {
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('touchcancel', onEnd);
        cleanupTouch.current = null;
      };
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    const p = press.current;
    const touch = e.touches[0];
    if (!p || p.active || !touch) return;
    if (Math.hypot(touch.clientX - p.x, touch.clientY - p.y) > TOUCH_TOLERANCE) {
      window.clearTimeout(timer.current);
      press.current = null;
    }
  };

  const onTouchEnd = () => {
    if (press.current && !press.current.active) {
      window.clearTimeout(timer.current);
      press.current = null;
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp, onTouchStart, onTouchMove, onTouchEnd };
}
