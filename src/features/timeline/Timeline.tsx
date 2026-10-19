import { useEffect, useLayoutEffect, useRef, type PointerEvent, type TouchEvent } from 'react';
import { getMainTrack, getMedia, projectDuration } from '../../core/project';
import { useEditorStore } from '../../store/editorStore';
import { useProject } from '../../store/projectStore';
import { ZoomInIcon, ZoomOutIcon } from '../../ui/icons';
import { ClipView } from './ClipView';
import { Ruler } from './Ruler';

/** Marge à gauche du temps 0, en pixels. */
const OFFSET = 16;
const ZOOM_FACTOR = 1.5;
/** Graduations affichées au-delà de la fin du projet, en pixels. */
const RULER_EXTRA_PX = 300;

export function Timeline() {
  const project = useProject();
  const playhead = useEditorStore((s) => s.playhead);
  const playing = useEditorStore((s) => s.playing);
  const pxPerSecond = useEditorStore((s) => s.pxPerSecond);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const previousZoom = useRef(pxPerSecond);

  const duration = projectDuration(project);
  const track = getMainTrack(project);
  const toX = (t: number) => OFFSET + (t / 1000) * pxPerSecond;
  const playheadX = toX(playhead);

  const timeFromPointer = (clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - OFFSET;
    return Math.min(duration, Math.max(0, (x / pxPerSecond) * 1000));
  };

  // Garder le curseur au même endroit de l'écran quand le zoom change.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const before = previousZoom.current;
    previousZoom.current = pxPerSecond;
    if (!el || before === pxPerSecond) return;
    const screenX = OFFSET + (playhead / 1000) * before - el.scrollLeft;
    el.scrollLeft = toX(playhead) - screenX;
  });

  // Faire défiler la timeline pendant la lecture.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    if (playheadX < el.scrollLeft || playheadX > el.scrollLeft + el.clientWidth - 24) {
      el.scrollLeft = playheadX - el.clientWidth * 0.25;
    }
  }, [playheadX, playing]);

  // Ctrl + molette : zoom (écouteur non passif pour bloquer le zoom de la page).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const { pxPerSecond: zoom, setZoom } = useEditorStore.getState();
      setZoom(zoom * Math.exp(-e.deltaY * 0.002));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubbing.current = true;
    const editor = useEditorStore.getState();
    editor.setPlaying(false);
    editor.setPlayhead(timeFromPointer(e.clientX));
  };
  const moveScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) useEditorStore.getState().setPlayhead(timeFromPointer(e.clientX));
  };
  const endScrub = () => {
    scrubbing.current = false;
  };

  const touchDistance = (e: TouchEvent) => {
    const [a, b] = [e.touches[0], e.touches[1]];
    return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
  };
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { distance: touchDistance(e), zoom: pxPerSecond };
  };
  const onTouchMove = (e: TouchEvent) => {
    const start = pinch.current;
    if (!start || e.touches.length !== 2 || start.distance === 0) return;
    useEditorStore.getState().setZoom(start.zoom * (touchDistance(e) / start.distance));
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null;
  };

  const zoomBy = (factor: number) => useEditorStore.getState().setZoom(pxPerSecond * factor);
  const select = (clipId: string) => useEditorStore.getState().select(clipId);

  return (
    <section className="flex flex-col border-t border-neutral-200 bg-neutral-50" aria-label="Timeline">
      <div className="flex items-center justify-end gap-1 px-3 pt-1">
        <button type="button" onClick={() => zoomBy(1 / ZOOM_FACTOR)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-200">
          <ZoomOutIcon width={16} height={16} />
          Dézoomer
        </button>
        <button type="button" onClick={() => zoomBy(ZOOM_FACTOR)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-200">
          <ZoomInIcon width={16} height={16} />
          Zoomer
        </button>
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-x-auto overflow-y-hidden pb-3"
        style={{ touchAction: 'pan-x' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative" style={{ width: `calc(${toX(duration)}px + 60vw)` }}>
          <div
            className="relative h-7 cursor-pointer touch-none"
            onPointerDown={startScrub}
            onPointerMove={moveScrub}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            aria-label="Règle : touchez ou glissez pour déplacer le curseur"
          >
            <Ruler span={duration + (RULER_EXTRA_PX / pxPerSecond) * 1000} pxPerSecond={pxPerSecond} offset={OFFSET} />
          </div>

          <div
            className="relative h-16"
            onClick={() => useEditorStore.getState().select(null)}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') startScrub(e);
            }}
            onPointerMove={moveScrub}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
          >
            {track.clips.length === 0 && (
              <p className="absolute inset-y-1 left-4 flex items-center rounded-lg border border-dashed border-neutral-300 px-4 text-sm text-neutral-500 select-none">
                Importez une vidéo ou une photo pour commencer
              </p>
            )}
            {track.clips.map((clip) => (
              <ClipView
                key={clip.id}
                clip={clip}
                media={getMedia(project, clip.mediaId)}
                left={toX(clip.start)}
                width={(clip.duration / 1000) * pxPerSecond}
                selected={clip.id === selectedClipId}
                onSelect={select}
              />
            ))}
          </div>

          <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-neutral-900" style={{ left: playheadX }}>
            <div className="absolute -top-0.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-neutral-900" />
          </div>
        </div>
      </div>
    </section>
  );
}
