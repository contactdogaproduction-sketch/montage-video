import { useEffect, useLayoutEffect, useRef, type PointerEvent, type TouchEvent } from 'react';
import { clipEnd } from '../../core/clip';
import { findClipLocation, projectDuration } from '../../core/project';
import { TRANSITION_LABELS } from '../../core/transition';
import { useEditorStore } from '../../store/editorStore';
import { onPlaybackTime } from '../../store/playbackClock';
import { useProject } from '../../store/projectStore';
import { ZoomInIcon, ZoomOutIcon } from '../../ui/icons';
import { ClipView, clipAppearance } from './ClipView';
import { dragPosition } from './drop';
import { useDragStore } from './dragStore';
import { LANE_HEIGHT, TIMELINE_OFFSET as OFFSET, displayTracks } from './layout';
import { MagnetToggle } from './MagnetToggle';
import { Ruler } from './Ruler';

const ZOOM_FACTOR = 1.5;
/** Graduations affichées au-delà de la fin du projet, en pixels. */
const RULER_EXTRA_PX = 300;

export function Timeline() {
  const project = useProject();
  const playhead = useEditorStore((s) => s.playhead);
  const pxPerSecond = useEditorStore((s) => s.pxPerSecond);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedTransitionId = useEditorStore((s) => s.selectedTransitionId);
  const drag = useDragStore((s) => s.drag);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const previousZoom = useRef(pxPerSecond);
  const playheadRef = useRef<HTMLDivElement>(null);

  const duration = projectDuration(project);
  const tracks = displayTracks(project);
  const toX = (t: number) => OFFSET + (t / 1000) * pxPerSecond;
  const playheadX = toX(playhead);

  const timeAtClientX = (clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - OFFSET;
    return (x / useEditorStore.getState().pxPerSecond) * 1000;
  };
  const scrubTime = (clientX: number) => Math.min(duration, Math.max(0, timeAtClientX(clientX)));

  useEffect(() => {
    useDragStore.getState().setTimeAtClientX(timeAtClientX);
  });

  // Garder le curseur au même endroit de l'écran quand le zoom change.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const before = previousZoom.current;
    previousZoom.current = pxPerSecond;
    if (!el || before === pxPerSecond) return;
    const screenX = OFFSET + (playhead / 1000) * before - el.scrollLeft;
    el.scrollLeft = toX(playhead) - screenX;
  });

  // Position du curseur à l'arrêt (pendant la lecture, c'est l'horloge ci-dessous qui le déplace).
  useLayoutEffect(() => {
    if (playheadRef.current && !useEditorStore.getState().playing) playheadRef.current.style.left = `${playheadX}px`;
  }, [playheadX]);

  // Pendant la lecture : le curseur avance à chaque image et la timeline défile, sans re-rendu de React.
  useEffect(
    () =>
      onPlaybackTime((t) => {
        const el = scrollRef.current;
        const line = playheadRef.current;
        if (!el || !line) return;
        const x = OFFSET + (t / 1000) * useEditorStore.getState().pxPerSecond;
        line.style.left = `${x}px`;
        if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = x - el.clientWidth * 0.25;
      }),
    [],
  );

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
    editor.setPlayhead(scrubTime(e.clientX));
  };
  const moveScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) useEditorStore.getState().setPlayhead(scrubTime(e.clientX));
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

  // Fantôme du clip glissé, à sa position aimantée, sous le doigt ou la souris.
  const dragged = drag ? findClipLocation(project, drag.clipId) : undefined;
  const position = drag ? dragPosition(project, drag) : null;
  const contentRect = contentRef.current?.getBoundingClientRect();
  const ghostHeight = dragged ? LANE_HEIGHT[dragged.track.kind] - 8 : 0;
  const ghostLook = dragged ? clipAppearance(project, dragged.clip) : null;

  return (
    <section className="flex flex-col border-t border-neutral-200 bg-neutral-50" aria-label="Timeline">
      <div className="flex items-center justify-end gap-1 px-3 pt-1">
        <MagnetToggle />
        <span className="flex-1" />
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
        className="relative max-h-[38dvh] overflow-auto pb-2"
        style={{ touchAction: 'pan-x pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div ref={contentRef} className="relative" style={{ width: `calc(${toX(duration)}px + 60vw)` }}>
          <div
            className="sticky top-0 z-20 h-7 cursor-pointer touch-none bg-neutral-50"
            onPointerDown={startScrub}
            onPointerMove={moveScrub}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            aria-label="Règle : touchez ou glissez pour déplacer le curseur"
          >
            <Ruler span={duration + (RULER_EXTRA_PX / pxPerSecond) * 1000} pxPerSecond={pxPerSecond} offset={OFFSET} />
          </div>

          {/* Emplacement toujours présent (pas de décalage des pistes au début d'un glisser). */}
          <div data-new-track="" className="h-9 py-1 pl-4">
            {drag && (
              <div
                className="flex h-full items-center rounded-lg border-2 border-dashed border-accent/50 px-3 text-xs text-accent select-none"
                style={{ width: 'min(100%, 85vw)' }}
              >
                Déposer ici pour créer une nouvelle piste
              </div>
            )}
          </div>

          {tracks.map((track) => (
            <div
              key={track.id}
              data-track-id={track.id}
              className={`relative border-b border-neutral-200/70 ${drag ? 'bg-accent/5' : ''}`}
              style={{ height: LANE_HEIGHT[track.kind] }}
              onClick={() => useEditorStore.getState().select(null)}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse') startScrub(e);
              }}
              onPointerMove={moveScrub}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
            >
              {track.kind === 'main' && duration === 0 && (
                <p className="absolute inset-y-1 left-4 flex items-center rounded-lg border border-dashed border-neutral-300 px-4 text-sm text-neutral-500 select-none">
                  Importez une vidéo ou une photo pour commencer
                </p>
              )}
              {track.clips.map((clip) => (
                <ClipView
                  key={clip.id}
                  project={project}
                  clip={clip}
                  left={toX(clip.start)}
                  width={(clip.duration / 1000) * pxPerSecond}
                  pxPerSecond={pxPerSecond}
                  selected={clip.id === selectedClipId}
                  dragging={clip.id === drag?.clipId}
                  onSelect={select}
                />
              ))}
              {track.kind === 'main' &&
                track.magnetic &&
                track.clips.slice(0, -1).map((clip, i) => {
                  const next = track.clips[i + 1];
                  if (!next) return null;
                  const center = (next.start + clipEnd(clip)) / 2;
                  const transition = clip.type === 'media' ? clip.transition : null;
                  const selected = selectedTransitionId === clip.id;
                  return (
                    <button
                      key={`transition-${clip.id}`}
                      type="button"
                      title={transition ? `Transition : ${TRANSITION_LABELS[transition.type]}` : 'Ajouter une transition'}
                      aria-label={transition ? `Transition : ${TRANSITION_LABELS[transition.type]}` : 'Ajouter une transition'}
                      className={`absolute top-1/2 z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border text-sm font-semibold shadow ${
                        selected
                          ? 'border-accent bg-accent text-white'
                          : transition
                            ? 'border-accent bg-white text-accent'
                            : 'border-neutral-300 bg-white text-neutral-600'
                      }`}
                      style={{ left: toX(center) }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        useEditorStore.getState().selectTransition(clip.id);
                      }}
                    >
                      {transition ? '⧓' : '+'}
                    </button>
                  );
                })}
            </div>
          ))}

          {position?.snappedTo != null && (
            <div className="pointer-events-none absolute top-7 bottom-0 z-30 w-px bg-amber-500" style={{ left: toX(position.snappedTo) }} />
          )}

          <div ref={playheadRef} className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 -translate-x-1/2 bg-neutral-900">
            <div className="absolute -top-0.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-neutral-900" />
          </div>
        </div>
      </div>

      {drag && dragged && ghostLook && position && contentRect && (
        <div
          className={`pointer-events-none fixed z-50 overflow-hidden rounded-lg opacity-90 shadow-lg ring-2 ring-accent ${ghostLook.className}`}
          style={{
            left: contentRect.left + toX(position.start),
            top: drag.clientY - ghostHeight / 2,
            width: Math.max(8, (dragged.clip.duration / 1000) * pxPerSecond),
            height: ghostHeight,
            ...ghostLook.style,
          }}
        >
          <span className="flex h-full items-center truncate px-3 text-xs font-medium whitespace-nowrap">{ghostLook.label}</span>
        </div>
      )}
    </section>
  );
}
